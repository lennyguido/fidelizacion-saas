-- =============================================================================
-- LOYALTY · Módulo de fidelización: programa, socios, puntos, recompensas y canjes.
--
-- Reglas (docs/ARCHITECTURE.md):
--   * Depende solo del núcleo. Lee core.customers / core.visits y reacciona a los
--     eventos del núcleo (visit.recorded, visit.voided, customer.anonymized).
--   * Los puntos viven en un libro (ledger) que solo se agrega, nunca se edita.
--     El saldo de cada socio se actualiza en la misma transacción.
--   * Socios, libro y canjes NO se escriben desde la app: solo con funciones.
--   * La configuración (programa y recompensas) la editan dueño/admin por RLS.
--   * Todo exige el módulo 'loyalty' activo en el negocio.
-- =============================================================================

create schema if not exists loyalty;
revoke all on schema loyalty from public;
grant usage on schema loyalty to authenticated, service_role;
alter default privileges in schema loyalty grant all on tables to service_role;
alter default privileges in schema loyalty grant all on sequences to service_role;
alter default privileges in schema loyalty grant execute on functions to service_role;

-- -----------------------------------------------------------------------------
-- Programa (uno por negocio)
-- Puntos de una visita = points_per_visit
--   + (si hay monto y monto >= min_amount_minor) floor(monto / amount_step_minor) * points_per_amount
-- Ejemplo: 1 punto por visita + 1 punto cada $1.000 (amount_step_minor = 100000).
-- 'stamps' (sellos) es la misma mecánica mostrada como tarjeta de sellos.
-- -----------------------------------------------------------------------------
create table loyalty.programs (
  business_id       uuid primary key references core.businesses (id) on delete restrict,
  enabled           boolean not null default true,
  kind              text not null default 'points' check (kind in ('points', 'stamps')),
  points_per_visit  integer not null default 1 check (points_per_visit between 0 and 1000),
  points_per_amount integer not null default 0 check (points_per_amount between 0 and 1000),
  amount_step_minor bigint check (amount_step_minor is null or amount_step_minor > 0),
  min_amount_minor  bigint not null default 0 check (min_amount_minor >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (points_per_amount = 0 or amount_step_minor is not null),
  check (points_per_visit > 0 or points_per_amount > 0)
);

create trigger programs_updated_at before update on loyalty.programs
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Socios: clientes del núcleo que se sumaron al programa (opcional, D-007)
-- -----------------------------------------------------------------------------
create table loyalty.members (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references core.businesses (id) on delete restrict,
  customer_id     uuid not null,
  status          text not null default 'active' check (status in ('active', 'left')),
  points_balance  bigint not null default 0,
  lifetime_points bigint not null default 0 check (lifetime_points >= 0),
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, customer_id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict,
  check ((status = 'left') = (left_at is not null))
);

create index members_created_by_idx on loyalty.members (created_by) where created_by is not null;

create trigger members_updated_at before update on loyalty.members
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Recompensas
-- -----------------------------------------------------------------------------
create table loyalty.rewards (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references core.businesses (id) on delete restrict,
  name            text not null check (char_length(btrim(name)) between 1 and 80),
  description     text check (char_length(description) <= 300),
  cost_points     integer not null check (cost_points between 1 and 100000),
  active          boolean not null default true,
  available_until timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, id)
);

create index rewards_business_idx on loyalty.rewards (business_id, active, cost_points);

create trigger rewards_updated_at before update on loyalty.rewards
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Canjes (en el mostrador: se confirman en el momento)
-- -----------------------------------------------------------------------------
create table loyalty.redemptions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references core.businesses (id) on delete restrict,
  member_id     uuid not null,
  reward_id     uuid not null,
  reward_name   text not null,
  points        integer not null check (points > 0),
  code          text not null check (code ~ '^[A-Z2-9]{6}$'),
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  request_id    uuid,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  cancelled_by  uuid references auth.users (id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) between 3 and 300),
  unique (business_id, id),
  unique (business_id, code),
  unique (business_id, request_id),
  foreign key (business_id, member_id) references loyalty.members (business_id, id) on delete restrict,
  foreign key (business_id, reward_id) references loyalty.rewards (business_id, id) on delete restrict,
  check ((status = 'cancelled') = (cancelled_at is not null and cancel_reason is not null))
);

create index redemptions_member_idx on loyalty.redemptions (business_id, member_id, created_at desc);
create index redemptions_reward_idx on loyalty.redemptions (business_id, reward_id);
create index redemptions_created_by_idx on loyalty.redemptions (created_by) where created_by is not null;
create index redemptions_cancelled_by_idx on loyalty.redemptions (cancelled_by) where cancelled_by is not null;

-- -----------------------------------------------------------------------------
-- Libro de puntos (solo se agrega)
-- -----------------------------------------------------------------------------
create table loyalty.ledger (
  id            bigint generated always as identity primary key,
  business_id   uuid not null references core.businesses (id) on delete restrict,
  member_id     uuid not null,
  delta         bigint not null check (delta <> 0),
  reason        text not null check (reason in
                  ('visit', 'visit_voided', 'redemption', 'redemption_cancelled', 'adjustment')),
  visit_id      uuid,
  redemption_id uuid,
  note          text check (char_length(note) <= 300),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (business_id, member_id) references loyalty.members (business_id, id) on delete restrict,
  foreign key (business_id, visit_id) references core.visits (business_id, id) on delete restrict,
  foreign key (business_id, redemption_id) references loyalty.redemptions (business_id, id) on delete restrict,
  check ((reason in ('visit', 'visit_voided')) = (visit_id is not null)),
  check ((reason in ('redemption', 'redemption_cancelled')) = (redemption_id is not null))
);

create index ledger_member_idx on loyalty.ledger (business_id, member_id, created_at desc);
-- Nunca dos acreditaciones (ni dos reversiones) por la misma visita o canje.
create unique index ledger_visit_once_idx on loyalty.ledger (business_id, visit_id, reason)
  where visit_id is not null;
create unique index ledger_redemption_once_idx on loyalty.ledger (business_id, redemption_id, reason)
  where redemption_id is not null;
create index ledger_created_by_idx on loyalty.ledger (created_by) where created_by is not null;

create function loyalty.ledger_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'the points ledger is append-only' using errcode = '42501';
end;
$$;

create trigger ledger_append_only before update or delete on loyalty.ledger
  for each row execute function loyalty.ledger_append_only();

-- -----------------------------------------------------------------------------
-- Auditoría (trigger genérico del núcleo)
-- -----------------------------------------------------------------------------
create trigger programs_audit after insert or update on loyalty.programs
  for each row execute function core.audit_row();
-- Socios: solo altas y cambios de estado (los movimientos de puntos ya quedan en el libro).
create trigger members_audit after insert or update of status on loyalty.members
  for each row execute function core.audit_row();
create trigger rewards_audit after insert or update on loyalty.rewards
  for each row execute function core.audit_row();
create trigger redemptions_audit after insert or update on loyalty.redemptions
  for each row execute function core.audit_row();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table loyalty.programs enable row level security;
alter table loyalty.members enable row level security;
alter table loyalty.rewards enable row level security;
alter table loyalty.redemptions enable row level security;
alter table loyalty.ledger enable row level security;

grant select on loyalty.programs, loyalty.members, loyalty.rewards, loyalty.redemptions, loyalty.ledger
  to authenticated;
grant insert (business_id, enabled, kind, points_per_visit, points_per_amount, amount_step_minor, min_amount_minor),
      update (enabled, kind, points_per_visit, points_per_amount, amount_step_minor, min_amount_minor)
  on loyalty.programs to authenticated;
grant insert (business_id, name, description, cost_points, active, available_until),
      update (name, description, cost_points, active, available_until)
  on loyalty.rewards to authenticated;

create policy programs_select on loyalty.programs for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));
create policy programs_insert on loyalty.programs for insert to authenticated
  with check (business_id in (select core.my_business_ids_with_module('loyalty'))
              and business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));
create policy programs_update on loyalty.programs for update to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty'))
         and business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])))
  with check (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

create policy rewards_select on loyalty.rewards for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));
create policy rewards_insert on loyalty.rewards for insert to authenticated
  with check (business_id in (select core.my_business_ids_with_module('loyalty'))
              and business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));
create policy rewards_update on loyalty.rewards for update to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty'))
         and business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])))
  with check (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

create policy members_select on loyalty.members for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));
create policy redemptions_select on loyalty.redemptions for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));
create policy ledger_select on loyalty.ledger for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));

-- -----------------------------------------------------------------------------
-- Funciones internas
-- -----------------------------------------------------------------------------
create function loyalty.require_module(p_business_id uuid) returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not core.has_module(p_business_id, 'loyalty') then
    perform core.raise_forbidden('module_disabled');
  end if;
end;
$$;

-- Puntos que da una visita según el programa (redondeo: siempre hacia abajo).
create function loyalty.points_for_visit(p_program loyalty.programs, p_amount_minor bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select least(100000,
    p_program.points_per_visit
    + case
        when p_program.points_per_amount > 0
         and p_amount_minor is not null
         and p_amount_minor >= p_program.min_amount_minor
        then (p_amount_minor / p_program.amount_step_minor) * p_program.points_per_amount
        else 0
      end)::bigint
$$;

-- Escribe un movimiento y actualiza el saldo (el socio ya tiene que estar bloqueado).
create function loyalty.post_movement(
  p_member      loyalty.members,
  p_delta       bigint,
  p_reason      text,
  p_visit_id    uuid default null,
  p_redemption_id uuid default null,
  p_note        text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into loyalty.ledger (business_id, member_id, delta, reason, visit_id, redemption_id, note, created_by)
  values (p_member.business_id, p_member.id, p_delta, p_reason, p_visit_id, p_redemption_id,
          nullif(btrim(p_note), ''), (select auth.uid()))
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    return false;  -- ya estaba registrado (doble acreditación evitada)
  end if;

  update loyalty.members
     set points_balance = points_balance + p_delta,
         lifetime_points = case
           when p_reason in ('visit', 'adjustment') and p_delta > 0 then lifetime_points + p_delta
           when p_reason = 'visit_voided' then greatest(lifetime_points + p_delta, 0)
           else lifetime_points
         end
   where id = p_member.id;
  return true;
end;
$$;

-- Reacciona a los eventos del núcleo. Nunca lanza errores: una falla acá no
-- puede impedir que se registre una visita.
create function loyalty.handle_core_event() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (new.payload ->> 'customer_id')::uuid;
  v_visit_id    uuid := (new.payload ->> 'visit_id')::uuid;
  v_program     loyalty.programs;
  v_member      loyalty.members;
  v_points      bigint;
begin
  if new.type = 'customer.anonymized' then
    update loyalty.members
       set status = 'left', left_at = coalesce(left_at, now())
     where business_id = new.business_id and customer_id = v_customer_id and status = 'active';
    return null;
  end if;

  if v_customer_id is null or v_visit_id is null then
    return null;
  end if;

  select * into v_member from loyalty.members
   where business_id = new.business_id and customer_id = v_customer_id
   for update;
  if not found then
    return null;
  end if;

  if new.type = 'visit.recorded' then
    if v_member.status <> 'active'
       or coalesce(new.payload ->> 'source', '') = 'import'
       or not core.has_module(new.business_id, 'loyalty') then
      return null;
    end if;
    select * into v_program from loyalty.programs where business_id = new.business_id and enabled;
    if not found then
      return null;
    end if;
    v_points := loyalty.points_for_visit(v_program, (new.payload ->> 'amount_minor')::bigint);
    if v_points > 0 then
      perform loyalty.post_movement(v_member, v_points, 'visit', v_visit_id);
    end if;

  elsif new.type = 'visit.voided' then
    select sum(delta) into v_points from loyalty.ledger
     where business_id = new.business_id and visit_id = v_visit_id and reason = 'visit';
    if coalesce(v_points, 0) > 0 then
      perform loyalty.post_movement(v_member, -v_points, 'visit_voided', v_visit_id);
    end if;
  end if;
  return null;
exception
  when others then
    raise warning 'loyalty.handle_core_event(%): %', new.id, sqlerrm;
    return null;
end;
$$;

create trigger loyalty_on_core_event after insert on core.events
  for each row
  when (new.type in ('visit.recorded', 'visit.voided', 'customer.anonymized'))
  execute function loyalty.handle_core_event();

-- Código corto para el comprobante del canje (sin 0/O/1/I para no confundir).
create function loyalty.new_redemption_code(p_business_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  for i in 1..20 loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    if not exists (select 1 from loyalty.redemptions where business_id = p_business_id and code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

-- -----------------------------------------------------------------------------
-- Funciones para el panel
-- -----------------------------------------------------------------------------

-- Sumar un cliente al programa (cualquier miembro del equipo). Idempotente.
create function loyalty.enroll_customer(p_customer_id uuid) returns loyalty.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
  v_member   loyalty.members;
begin
  select * into v_customer from core.customers where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_customer.business_id);
  perform loyalty.require_module(v_customer.business_id);
  if v_customer.status <> 'active' or v_customer.anonymized_at is not null then
    raise exception 'customer_not_active' using errcode = '22023';
  end if;

  insert into loyalty.members (business_id, customer_id, created_by)
  values (v_customer.business_id, p_customer_id, (select auth.uid()))
  on conflict (business_id, customer_id) do update
    set status = 'active', left_at = null
    where loyalty.members.status = 'left'
  returning * into v_member;

  if v_member.id is null then
    select * into v_member from loyalty.members
     where business_id = v_customer.business_id and customer_id = p_customer_id;
  else
    perform core.emit_event(v_customer.business_id, 'loyalty.member_joined',
                            jsonb_build_object('member_id', v_member.id, 'customer_id', p_customer_id));
  end if;
  return v_member;
end;
$$;

-- Salir del programa (el saldo se conserva por si vuelve).
create function loyalty.leave_program(p_member_id uuid) returns loyalty.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member loyalty.members;
begin
  select * into v_member from loyalty.members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_member.business_id);
  perform loyalty.require_module(v_member.business_id);
  if v_member.status = 'left' then
    return v_member;
  end if;
  update loyalty.members set status = 'left', left_at = now() where id = p_member_id
  returning * into v_member;
  return v_member;
end;
$$;

-- Canjear una recompensa en el mostrador (cualquier miembro del equipo).
-- p_request_id: identificador que manda el panel para que un doble toque no canjee dos veces.
create function loyalty.redeem_reward(p_member_id uuid, p_reward_id uuid, p_request_id uuid default null)
returns loyalty.redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member     loyalty.members;
  v_reward     loyalty.rewards;
  v_redemption loyalty.redemptions;
begin
  -- Bloquear al socio serializa los canjes: dos canjes simultáneos no pueden gastar el mismo saldo.
  select * into v_member from loyalty.members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_member.business_id);
  perform loyalty.require_module(v_member.business_id);

  if p_request_id is not null then
    select * into v_redemption from loyalty.redemptions
     where business_id = v_member.business_id and request_id = p_request_id;
    if found then
      return v_redemption;
    end if;
  end if;

  if v_member.status <> 'active' then
    raise exception 'member_inactive' using errcode = '22023';
  end if;

  select * into v_reward from loyalty.rewards
   where id = p_reward_id and business_id = v_member.business_id;
  if not found then
    raise exception 'reward not found' using errcode = 'P0002';
  end if;
  if not v_reward.active or (v_reward.available_until is not null and v_reward.available_until <= now()) then
    raise exception 'reward_unavailable' using errcode = '22023';
  end if;
  if v_member.points_balance < v_reward.cost_points then
    raise exception 'insufficient_points' using errcode = '22023';
  end if;

  insert into loyalty.redemptions (business_id, member_id, reward_id, reward_name, points, code,
                                   request_id, created_by)
  values (v_member.business_id, v_member.id, v_reward.id, v_reward.name, v_reward.cost_points,
          loyalty.new_redemption_code(v_member.business_id), p_request_id, (select auth.uid()))
  returning * into v_redemption;

  perform loyalty.post_movement(v_member, -v_reward.cost_points, 'redemption', null, v_redemption.id);

  perform core.emit_event(v_member.business_id, 'loyalty.reward_redeemed', jsonb_build_object(
    'redemption_id', v_redemption.id, 'member_id', v_member.id,
    'customer_id', v_member.customer_id, 'reward_id', v_reward.id, 'points', v_reward.cost_points));
  return v_redemption;
end;
$$;

-- Cancelar un canje y devolver los puntos (solo dueño/admin, con motivo).
create function loyalty.cancel_redemption(p_redemption_id uuid, p_reason text) returns loyalty.redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption loyalty.redemptions;
  v_member     loyalty.members;
begin
  select * into v_redemption from loyalty.redemptions where id = p_redemption_id for update;
  if not found then
    raise exception 'redemption not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_redemption.business_id, array['owner', 'admin']);
  perform loyalty.require_module(v_redemption.business_id);
  if v_redemption.status = 'cancelled' then
    raise exception 'redemption already cancelled' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select * into v_member from loyalty.members where id = v_redemption.member_id for update;

  update loyalty.redemptions
     set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()),
         cancel_reason = btrim(p_reason)
   where id = p_redemption_id
  returning * into v_redemption;

  perform loyalty.post_movement(v_member, v_redemption.points, 'redemption_cancelled', null,
                                v_redemption.id, p_reason);
  return v_redemption;
end;
$$;

-- Ajuste manual de puntos (solo dueño/admin, con motivo). No deja el saldo negativo.
create function loyalty.adjust_points(p_member_id uuid, p_delta bigint, p_note text) returns loyalty.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member loyalty.members;
begin
  select * into v_member from loyalty.members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_member.business_id, array['owner', 'admin']);
  perform loyalty.require_module(v_member.business_id);
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'invalid points' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if v_member.points_balance + p_delta < 0 then
    raise exception 'insufficient_points' using errcode = '22023';
  end if;

  perform loyalty.post_movement(v_member, p_delta, 'adjustment', null, null, p_note);
  select * into v_member from loyalty.members where id = p_member_id;
  return v_member;
end;
$$;

grant execute on function
  loyalty.enroll_customer(uuid),
  loyalty.leave_program(uuid),
  loyalty.redeem_reward(uuid, uuid, uuid),
  loyalty.cancel_redemption(uuid, text),
  loyalty.adjust_points(uuid, bigint, text)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public, anon;
revoke execute on all functions in schema core from public, anon;
