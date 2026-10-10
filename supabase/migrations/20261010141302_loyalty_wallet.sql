-- =============================================================================
-- LOYALTY · Tarjeta en Google Wallet / Apple Wallet (docs/WALLET.md).
--
-- El cliente puede guardar su tarjeta de puntos en la billetera del teléfono.
-- Todo lo habla la Edge Function `wallet` con la service role: estas tablas y
-- funciones NO tienen permisos para el panel ni para la tarjeta (anon).
--   * wallet_passes:  un pase por socio y proveedor ('google' | 'apple').
--   * wallet_devices: iPhones registrados para recibir actualizaciones (Apple).
--   * wallet_updates: cola de "este pase cambió, hay que avisarle a Google/Apple".
--     La llena un trigger cuando cambia el saldo o el estado del socio.
-- Solo se guarda un id opaco del pase y el hash del token de Apple: nada de
-- teléfono, email ni nombre.
-- =============================================================================

create table loyalty.wallet_passes (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references core.businesses (id) on delete restrict,
  member_id       uuid not null,
  provider        text not null check (provider in ('google', 'apple')),
  -- Google: sufijo del id del objeto (el id completo es "<issuer>.<object_id>").
  -- Apple: serialNumber del pase.
  object_id       text not null default replace(gen_random_uuid()::text, '-', '')
                    check (object_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  -- Apple: sha256 (hex) del authenticationToken del pase. Google no lo usa.
  auth_token_hash text check (auth_token_hash is null or auth_token_hash ~ '^[0-9a-f]{64}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_pushed_at  timestamptz,
  unique (business_id, id),
  unique (business_id, member_id, provider),
  unique (provider, object_id),
  foreign key (business_id, member_id) references loyalty.members (business_id, id) on delete restrict
);
create index wallet_passes_business_idx on loyalty.wallet_passes (business_id, member_id);
alter table loyalty.wallet_passes enable row level security;
revoke all on loyalty.wallet_passes from authenticated, anon;

create table loyalty.wallet_devices (
  business_id       uuid not null references core.businesses (id) on delete restrict,
  pass_id           uuid not null,
  device_library_id text not null check (length(device_library_id) between 1 and 200),
  push_token        text not null check (length(push_token) between 1 and 400),
  created_at        timestamptz not null default now(),
  primary key (pass_id, device_library_id),
  foreign key (business_id, pass_id) references loyalty.wallet_passes (business_id, id) on delete cascade
);
create index wallet_devices_business_idx on loyalty.wallet_devices (business_id);
create index wallet_devices_device_idx on loyalty.wallet_devices (device_library_id);
alter table loyalty.wallet_devices enable row level security;
revoke all on loyalty.wallet_devices from authenticated, anon;

create table loyalty.wallet_updates (
  id              bigint generated always as identity primary key,
  business_id     uuid not null references core.businesses (id) on delete restrict,
  pass_id         uuid not null,
  status          text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  -- Sube cada vez que el pase vuelve a cambiar mientras el aviso está pendiente:
  -- así un aviso que se mandó con datos viejos no se da por terminado.
  revision        int not null default 1,
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error      text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  foreign key (business_id, pass_id) references loyalty.wallet_passes (business_id, id) on delete cascade
);
create index wallet_updates_business_idx on loyalty.wallet_updates (business_id, created_at);
create unique index wallet_updates_one_pending on loyalty.wallet_updates (pass_id) where status = 'pending';
create index wallet_updates_due_idx on loyalty.wallet_updates (next_attempt_at) where status = 'pending';
alter table loyalty.wallet_updates enable row level security;
revoke all on loyalty.wallet_updates from authenticated, anon;

grant select, insert, update, delete on loyalty.wallet_passes, loyalty.wallet_devices, loyalty.wallet_updates
  to service_role;

-- -----------------------------------------------------------------------------
-- Cuando cambia el saldo o el estado de un socio, sus pases quedan "para
-- actualizar". Si ya había un aviso pendiente, se reutiliza (sube la revisión).
-- Nunca hace fallar el movimiento de puntos: si algo sale mal, queda un warning.
-- -----------------------------------------------------------------------------
create function loyalty.enqueue_wallet_updates() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update loyalty.wallet_passes set updated_at = now()
   where business_id = new.business_id and member_id = new.id;
  insert into loyalty.wallet_updates (business_id, pass_id)
  select p.business_id, p.id from loyalty.wallet_passes p
   where p.business_id = new.business_id and p.member_id = new.id
  on conflict (pass_id) where status = 'pending'
  do update set revision = loyalty.wallet_updates.revision + 1;
  return null;
exception when others then
  raise warning 'loyalty.enqueue_wallet_updates failed for member %: %', new.id, sqlerrm;
  return null;
end;
$$;

create trigger members_wallet_updates after update of points_balance, status on loyalty.members
  for each row
  when (old.points_balance is distinct from new.points_balance or old.status is distinct from new.status)
  execute function loyalty.enqueue_wallet_updates();

-- -----------------------------------------------------------------------------
-- Datos que muestra el pase. Lo mínimo (D-020): nombre de pila, puntos, código
-- de socio, marca del negocio y la próxima recompensa. Nunca teléfono ni email.
-- active = false si el socio salió, el cliente está archivado/anonimizado o el
-- módulo está apagado: el pase se muestra como inactivo y sin nombre.
-- -----------------------------------------------------------------------------
create function loyalty.wallet_pass_data(p_pass_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pass     loyalty.wallet_passes;
  v_member   loyalty.members;
  v_customer core.customers;
  v_business core.businesses;
  v_program  loyalty.programs;
  v_active   boolean;
  v_next     jsonb;
begin
  select * into v_pass from loyalty.wallet_passes where id = p_pass_id;
  if not found then
    return null;
  end if;
  select * into v_member from loyalty.members where business_id = v_pass.business_id and id = v_pass.member_id;
  select * into v_customer from core.customers
   where business_id = v_member.business_id and id = v_member.customer_id;
  select * into v_business from core.businesses where id = v_pass.business_id;
  select * into v_program from loyalty.programs where business_id = v_pass.business_id;

  v_active := v_member.status = 'active' and v_customer.status = 'active'
              and v_customer.anonymized_at is null and core.has_module(v_pass.business_id, 'loyalty');

  select jsonb_build_object('name', r.name, 'costPoints', r.cost_points) into v_next
    from loyalty.rewards r
   where r.business_id = v_pass.business_id and r.active
     and (r.available_until is null or r.available_until > now())
     and r.cost_points > v_member.points_balance
   order by r.cost_points, r.id
   limit 1;

  return jsonb_build_object(
    'passId', v_pass.id,
    'provider', v_pass.provider,
    'objectId', v_pass.object_id,
    'businessId', v_pass.business_id,
    'updatedAt', v_pass.updated_at,
    'active', v_active,
    'business', jsonb_build_object(
      'name', v_business.name, 'primaryColor', v_business.primary_color, 'logoPath', v_business.logo_path),
    'firstName', case when v_active then split_part(btrim(v_customer.name), ' ', 1) else null end,
    'memberCode', v_member.member_code,
    'pointsBalance', v_member.points_balance,
    'unit', case when v_program.kind = 'stamps' then 'sellos' else 'puntos' end,
    'nextReward', v_next,
    'rewardsAvailable', (
      select count(*) from loyalty.rewards r
       where r.business_id = v_pass.business_id and r.active
         and (r.available_until is null or r.available_until > now())
         and r.cost_points <= v_member.points_balance)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear (o volver a usar) el pase de la tarjeta del link secreto (D-020).
-- Devuelve null si el link no sirve (mismas reglas que loyalty.get_card).
-- p_auth_token_hash: solo Apple; reemplaza el token anterior del pase.
-- -----------------------------------------------------------------------------
create function loyalty.wallet_issue_pass(p_card_token text, p_provider text, p_auth_token_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  loyalty.members;
  v_pass_id uuid;
begin
  if p_provider not in ('google', 'apple') then
    raise exception 'invalid provider' using errcode = '22023';
  end if;
  if loyalty.get_card(p_card_token) is null then
    return null;
  end if;
  select m.* into v_member
    from loyalty.cards c join loyalty.members m on m.id = c.member_id and m.business_id = c.business_id
   where c.token_hash = encode(sha256(convert_to(p_card_token, 'UTF8')), 'hex');

  insert into loyalty.wallet_passes (business_id, member_id, provider, auth_token_hash)
  values (v_member.business_id, v_member.id, p_provider, p_auth_token_hash)
  on conflict (business_id, member_id, provider) do update
    set auth_token_hash = coalesce(excluded.auth_token_hash, loyalty.wallet_passes.auth_token_hash),
        updated_at = now()
  returning id into v_pass_id;

  return loyalty.wallet_pass_data(v_pass_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Cola de avisos. claim toma hasta p_limit avisos vencidos de un proveedor y los
-- "reserva" 10 minutos (si la función se cae, se reintentan solos). finish los
-- da por terminados o programa un reintento con espera creciente; a los 8
-- intentos quedan como 'failed'.
-- -----------------------------------------------------------------------------
create function loyalty.wallet_claim_updates(p_provider text, p_limit int default 50) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with due as (
    select u.id from loyalty.wallet_updates u
      join loyalty.wallet_passes p on p.business_id = u.business_id and p.id = u.pass_id
     where u.status = 'pending' and u.next_attempt_at <= now() and p.provider = p_provider
     order by u.next_attempt_at, u.id
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update of u skip locked
  ), claimed as (
    update loyalty.wallet_updates u
       set attempts = u.attempts + 1, next_attempt_at = now() + interval '10 minutes'
      from due where u.id = due.id
    returning u.id, u.pass_id, u.revision, u.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'updateId', c.id, 'revision', c.revision, 'attempts', c.attempts,
           'pass', loyalty.wallet_pass_data(c.pass_id)) order by c.id), '[]'::jsonb)
    into v_result
    from claimed c;
  return v_result;
end;
$$;

create function loyalty.wallet_finish_update(p_update_id bigint, p_revision int, p_error text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_update loyalty.wallet_updates;
begin
  select * into v_update from loyalty.wallet_updates where id = p_update_id for update;
  if not found or v_update.status <> 'pending' then
    return 'ignored';
  end if;

  if p_error is null then
    update loyalty.wallet_passes set last_pushed_at = now()
     where business_id = v_update.business_id and id = v_update.pass_id;
    if v_update.revision <> p_revision then
      -- Cambió de nuevo mientras se mandaba: queda pendiente para mandar lo último.
      update loyalty.wallet_updates set attempts = 0, next_attempt_at = now(), last_error = null
       where id = p_update_id;
      return 'requeued';
    end if;
    update loyalty.wallet_updates set status = 'done', processed_at = now(), last_error = null
     where id = p_update_id;
    return 'done';
  end if;

  if v_update.attempts >= 8 then
    update loyalty.wallet_updates
       set status = 'failed', processed_at = now(), last_error = left(p_error, 500)
     where id = p_update_id;
    return 'failed';
  end if;
  update loyalty.wallet_updates
     set last_error = left(p_error, 500),
         next_attempt_at = now() + make_interval(mins => least(power(2, v_update.attempts)::int, 360))
   where id = p_update_id;
  return 'retry';
end;
$$;

-- -----------------------------------------------------------------------------
-- Apple Wallet web service (PassKit). El iPhone se identifica con el
-- authenticationToken del pase; acá llega solo su hash.
-- -----------------------------------------------------------------------------
create function loyalty.wallet_apple_pass(p_serial text, p_auth_token_hash text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pass_id uuid;
begin
  select id into v_pass_id from loyalty.wallet_passes
   where provider = 'apple' and object_id = p_serial
     and auth_token_hash is not null and auth_token_hash = p_auth_token_hash;
  if not found then
    return null;
  end if;
  return loyalty.wallet_pass_data(v_pass_id);
end;
$$;

-- Devuelve 'created', 'exists' o 'unauthorized'.
create function loyalty.wallet_apple_register(
  p_serial text, p_auth_token_hash text, p_device_id text, p_push_token text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass   loyalty.wallet_passes;
  v_exists boolean;
begin
  select * into v_pass from loyalty.wallet_passes
   where provider = 'apple' and object_id = p_serial
     and auth_token_hash is not null and auth_token_hash = p_auth_token_hash;
  if not found then
    return 'unauthorized';
  end if;
  v_exists := exists (select 1 from loyalty.wallet_devices
                       where pass_id = v_pass.id and device_library_id = p_device_id);
  insert into loyalty.wallet_devices (business_id, pass_id, device_library_id, push_token)
  values (v_pass.business_id, v_pass.id, p_device_id, p_push_token)
  on conflict (pass_id, device_library_id) do update set push_token = excluded.push_token;
  return case when v_exists then 'exists' else 'created' end;
end;
$$;

-- Devuelve 'deleted' o 'unauthorized'.
create function loyalty.wallet_apple_unregister(p_serial text, p_auth_token_hash text, p_device_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pass loyalty.wallet_passes;
begin
  select * into v_pass from loyalty.wallet_passes
   where provider = 'apple' and object_id = p_serial
     and auth_token_hash is not null and auth_token_hash = p_auth_token_hash;
  if not found then
    return 'unauthorized';
  end if;
  delete from loyalty.wallet_devices where pass_id = v_pass.id and device_library_id = p_device_id;
  return 'deleted';
end;
$$;

-- Pases de un iPhone que cambiaron después de p_since (null = todos).
-- lastUpdated es la marca que el iPhone manda la próxima vez (passesUpdatedSince).
create function loyalty.wallet_apple_serials(p_device_id text, p_since timestamptz default null) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'serialNumbers', coalesce(jsonb_agg(p.object_id order by p.object_id), '[]'::jsonb),
    'lastUpdated', max(p.updated_at))
    from loyalty.wallet_devices d
    join loyalty.wallet_passes p on p.business_id = d.business_id and p.id = d.pass_id
   where d.device_library_id = p_device_id and p.provider = 'apple'
     and (p_since is null or p.updated_at > p_since)
$$;

-- Tokens de los iPhones de un pase (para el aviso por APNs).
create function loyalty.wallet_apple_push_tokens(p_pass_id uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct d.push_token), '[]'::jsonb)
    from loyalty.wallet_devices d where d.pass_id = p_pass_id
$$;

-- Solo la Edge Function (service role) usa estas funciones.
revoke execute on all functions in schema loyalty from public, anon;
revoke execute on function
  loyalty.wallet_pass_data(uuid),
  loyalty.wallet_issue_pass(text, text, text),
  loyalty.wallet_claim_updates(text, int),
  loyalty.wallet_finish_update(bigint, int, text),
  loyalty.wallet_apple_pass(text, text),
  loyalty.wallet_apple_register(text, text, text, text),
  loyalty.wallet_apple_unregister(text, text, text),
  loyalty.wallet_apple_serials(text, timestamptz),
  loyalty.wallet_apple_push_tokens(uuid),
  loyalty.enqueue_wallet_updates()
from authenticated;
grant execute on function
  loyalty.wallet_pass_data(uuid),
  loyalty.wallet_issue_pass(text, text, text),
  loyalty.wallet_claim_updates(text, int),
  loyalty.wallet_finish_update(bigint, int, text),
  loyalty.wallet_apple_pass(text, text),
  loyalty.wallet_apple_register(text, text, text, text),
  loyalty.wallet_apple_unregister(text, text, text),
  loyalty.wallet_apple_serials(text, timestamptz),
  loyalty.wallet_apple_push_tokens(uuid)
to service_role;
grant execute on function loyalty.get_card(text) to anon;
revoke execute on all functions in schema core from public, anon;
