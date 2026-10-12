-- =============================================================================
-- LOYALTY · "Traé un amigo" (OPORTUNIDADES #7) y CORE · opiniones y link de
-- reseñas de Google (OPORTUNIDADES #8). Plan de Claude Code, tarea 6. D-036.
--
-- Esta migración NO tiene nada para usuarios sin cuenta (anon): se puede aplicar.
-- La encuesta desde la tarjeta del cliente (función anon) está en la siguiente
-- migración, que espera la revisión del mentor.
--
-- Traé un amigo:
--   * Configurable en el programa (apagado por defecto): puntos para quien invita
--     y para el amigo.
--   * Cada socio tiene un código de invitación de 6 caracteres (distinto del
--     código de socio de 8 y del link secreto).
--   * En el mostrador, al dar de alta al amigo, se carga el código de quien lo
--     invitó (loyalty.set_referrer). El amigo tiene que ser un socio sin visitas.
--     No se puede invitar a uno mismo ni al que te invitó a vos.
--   * El premio para los dos se da solo con la primera visita real del amigo que
--     sume puntos (respeta los topes; las importadas no suman). Una sola vez. Si
--     esa visita se anula, el premio se descuenta.
--   * Ranking "Quién trae más gente" (dueño/admin).
--
-- Opiniones y reseñas:
--   * core.businesses.google_review_url: solo links de Google (g.page,
--     google.com, maps.app.goo.gl, search.google.com).
--   * core.feedback: una opinión (1 a 5) por visita, de las últimas 48 h. Solo la
--     ve dueño/admin. Con 3 o menos es un aviso privado para el dueño.
--   * core.record_feedback es interna (la usa la encuesta de la tarjeta).
--   * A todos se les ofrece el link de Google, sin premio ni filtro (Google
--     prohíbe premiar o filtrar reseñas).
--
-- No destructiva: agrega columnas, tablas y funciones; amplía los motivos del
-- libro de puntos y reemplaza el manejador de eventos de loyalty.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LOYALTY · Configuración y códigos de invitación
-- -----------------------------------------------------------------------------
alter table loyalty.programs
  add column referral_enabled         boolean not null default false,
  add column referral_points_referrer integer not null default 0
    check (referral_points_referrer between 0 and 10000),
  add column referral_points_friend   integer not null default 0
    check (referral_points_friend between 0 and 10000);

grant insert (referral_enabled, referral_points_referrer, referral_points_friend),
      update (referral_enabled, referral_points_referrer, referral_points_friend)
  on loyalty.programs to authenticated;

alter table loyalty.ledger drop constraint ledger_reason_check;
alter table loyalty.ledger add constraint ledger_reason_check check (reason in
  ('visit', 'visit_voided', 'redemption', 'redemption_cancelled', 'adjustment',
   'referral', 'referral_voided'));

create function loyalty.new_referral_code(p_business_id uuid) returns text
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
    if not exists (select 1 from loyalty.members
                    where business_id = p_business_id and referral_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

alter table loyalty.members add column referral_code text check (referral_code ~ '^[A-Z2-9]{6}$');
update loyalty.members m set referral_code = loyalty.new_referral_code(m.business_id)
 where referral_code is null;
alter table loyalty.members alter column referral_code set not null;
alter table loyalty.members
  add constraint members_business_referral_code_key unique (business_id, referral_code);

create function loyalty.set_referral_code() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.referral_code is null then
    new.referral_code := loyalty.new_referral_code(new.business_id);
  end if;
  return new;
end;
$$;

create trigger members_referral_code before insert on loyalty.members
  for each row execute function loyalty.set_referral_code();

-- -----------------------------------------------------------------------------
-- LOYALTY · Invitaciones
-- -----------------------------------------------------------------------------
create table loyalty.referrals (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references core.businesses (id) on delete restrict,
  referrer_member_id uuid not null,
  friend_member_id   uuid not null,
  status             text not null default 'pending'
                     check (status in ('pending', 'rewarded', 'voided')),
  reward_visit_id    uuid,
  referrer_points    integer not null default 0,
  friend_points      integer not null default 0,
  rewarded_at        timestamptz,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, friend_member_id),
  foreign key (business_id, referrer_member_id) references loyalty.members (business_id, id) on delete restrict,
  foreign key (business_id, friend_member_id) references loyalty.members (business_id, id) on delete restrict,
  foreign key (business_id, reward_visit_id) references core.visits (business_id, id) on delete restrict,
  check (referrer_member_id <> friend_member_id),
  check ((status = 'pending') = (rewarded_at is null))
);

create index referrals_referrer_idx on loyalty.referrals (business_id, referrer_member_id);
create index referrals_reward_visit_idx on loyalty.referrals (business_id, reward_visit_id)
  where reward_visit_id is not null;
create index referrals_created_by_idx on loyalty.referrals (created_by) where created_by is not null;

create trigger referrals_audit after insert or update on loyalty.referrals
  for each row execute function core.audit_row();

alter table loyalty.referrals enable row level security;
grant select on loyalty.referrals to authenticated;
create policy referrals_select on loyalty.referrals for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('loyalty')));

-- Cargar quién invitó a un socio nuevo (cualquier miembro del equipo, en el mostrador).
create function loyalty.set_referrer(p_friend_member_id uuid, p_code text) returns loyalty.referrals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_friend   loyalty.members;
  v_referrer loyalty.members;
  v_program  loyalty.programs;
  v_referral loyalty.referrals;
  v_code     text := upper(btrim(coalesce(p_code, '')));
begin
  select * into v_friend from loyalty.members where id = p_friend_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_friend.business_id);
  perform loyalty.require_module(v_friend.business_id);

  select * into v_program from loyalty.programs where business_id = v_friend.business_id;
  if not found or not v_program.referral_enabled then
    raise exception 'referrals are off' using errcode = '22023';
  end if;
  if v_friend.status <> 'active' then
    raise exception 'member is not active' using errcode = '22023';
  end if;

  select * into v_referrer from loyalty.members
   where business_id = v_friend.business_id and referral_code = v_code;
  if not found or v_referrer.status <> 'active' then
    raise exception 'referral code not found' using errcode = 'P0002';
  end if;
  if v_referrer.id = v_friend.id then
    raise exception 'cannot refer yourself' using errcode = '22023';
  end if;
  if exists (select 1 from loyalty.referrals
              where business_id = v_friend.business_id and friend_member_id = v_friend.id) then
    raise exception 'member already has a referrer' using errcode = '23505';
  end if;
  if exists (select 1 from loyalty.referrals
              where business_id = v_friend.business_id
                and friend_member_id = v_referrer.id and referrer_member_id = v_friend.id) then
    raise exception 'referral cycle' using errcode = '22023';
  end if;
  if exists (select 1 from core.visits
              where business_id = v_friend.business_id and customer_id = v_friend.customer_id
                and voided_at is null) then
    raise exception 'friend already has visits' using errcode = '22023';
  end if;

  insert into loyalty.referrals (business_id, referrer_member_id, friend_member_id, created_by)
  values (v_friend.business_id, v_referrer.id, v_friend.id, (select auth.uid()))
  returning * into v_referral;
  return v_referral;
end;
$$;

-- Premio de la primera visita del amigo. Interna: la llama el manejador de eventos
-- después de acreditar la visita (así respeta los mismos topes).
create function loyalty.reward_referral(p_friend loyalty.members, p_visit_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral loyalty.referrals;
  v_program  loyalty.programs;
  v_referrer loyalty.members;
  v_friend_pts integer := 0;
  v_referrer_pts integer := 0;
begin
  select * into v_referral from loyalty.referrals
   where business_id = p_friend.business_id and friend_member_id = p_friend.id and status = 'pending'
   for update;
  if not found then
    return;
  end if;
  select * into v_program from loyalty.programs
   where business_id = p_friend.business_id and referral_enabled;
  if not found then
    return;
  end if;

  if v_program.referral_points_friend > 0 then
    select * into p_friend from loyalty.members where id = p_friend.id for update;
    perform loyalty.post_movement(p_friend, v_program.referral_points_friend, 'referral',
                                  null, null, 'Premio por venir invitado');
    v_friend_pts := v_program.referral_points_friend;
  end if;

  select * into v_referrer from loyalty.members where id = v_referral.referrer_member_id for update;
  if v_referrer.status = 'active' and v_program.referral_points_referrer > 0 then
    perform loyalty.post_movement(v_referrer, v_program.referral_points_referrer, 'referral',
                                  null, null, 'Premio por invitar a un amigo');
    v_referrer_pts := v_program.referral_points_referrer;
  end if;

  update loyalty.referrals
     set status = 'rewarded', rewarded_at = now(), reward_visit_id = p_visit_id,
         friend_points = v_friend_pts, referrer_points = v_referrer_pts
   where id = v_referral.id;
end;
$$;

-- Si se anula la visita que dio el premio, se descuenta a los dos.
create function loyalty.void_referral_reward(p_business_id uuid, p_visit_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral loyalty.referrals;
  v_member   loyalty.members;
begin
  select * into v_referral from loyalty.referrals
   where business_id = p_business_id and reward_visit_id = p_visit_id and status = 'rewarded'
   for update;
  if not found then
    return;
  end if;
  if v_referral.friend_points > 0 then
    select * into v_member from loyalty.members where id = v_referral.friend_member_id for update;
    perform loyalty.post_movement(v_member, -v_referral.friend_points, 'referral_voided',
                                  null, null, 'Se anuló la visita del premio');
  end if;
  if v_referral.referrer_points > 0 then
    select * into v_member from loyalty.members where id = v_referral.referrer_member_id for update;
    perform loyalty.post_movement(v_member, -v_referral.referrer_points, 'referral_voided',
                                  null, null, 'Se anuló la visita del premio');
  end if;
  update loyalty.referrals set status = 'voided' where id = v_referral.id;
end;
$$;

-- Ranking "Quién trae más gente" (dueño/admin).
create function loyalty.referral_ranking(p_business_id uuid)
returns table (member_id uuid, name text, rewarded integer, pending integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform loyalty.require_module(p_business_id);
  return query
    select m.id, c.name,
           (count(*) filter (where r.status = 'rewarded'))::int,
           (count(*) filter (where r.status = 'pending'))::int
      from loyalty.referrals r
      join loyalty.members m on m.business_id = r.business_id and m.id = r.referrer_member_id
      join core.customers c on c.business_id = m.business_id and c.id = m.customer_id
     where r.business_id = p_business_id and c.anonymized_at is null
     group by m.id, c.name
     order by 3 desc, 4 desc, c.name
     limit 10;
end;
$$;

-- -----------------------------------------------------------------------------
-- LOYALTY · Manejador de eventos (igual que antes + premio por invitación)
-- -----------------------------------------------------------------------------
create or replace function loyalty.handle_core_event() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_visit_id    uuid;
  v_visit       core.visits;
  v_program     loyalty.programs;
  v_member      loyalty.members;
  v_tz          text;
  v_points      bigint;
  v_credited    integer;
begin
  v_customer_id := (new.payload ->> 'customer_id')::uuid;
  v_visit_id    := (new.payload ->> 'visit_id')::uuid;

  if new.type = 'customer.anonymized' then
    update loyalty.members
       set status = 'left', left_at = coalesce(left_at, now())
     where business_id = new.business_id and customer_id = v_customer_id and status = 'active';
    delete from loyalty.cards c
     using loyalty.members m
     where m.id = c.member_id and m.business_id = new.business_id and m.customer_id = v_customer_id;
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
    if v_member.status <> 'active' or not core.has_module(new.business_id, 'loyalty') then
      return null;
    end if;

    select * into v_visit from core.visits
     where business_id = new.business_id and id = v_visit_id and customer_id = v_customer_id;
    if not found
       or v_visit.voided_at is not null
       or v_visit.source = 'import'
       -- Solo visitas cargadas en el momento (ni atrasadas ni cargadas tarde).
       or v_visit.occurred_at < now() - interval '30 minutes' then
      return null;
    end if;

    select * into v_program from loyalty.programs where business_id = new.business_id and enabled;
    if not found then
      return null;
    end if;

    -- Tope de visitas que suman por día (día en la zona horaria del negocio).
    select timezone into v_tz from core.businesses where id = new.business_id;
    select count(*) into v_credited
      from loyalty.ledger l
      join core.visits v on v.business_id = l.business_id and v.id = l.visit_id
     where l.business_id = new.business_id
       and l.member_id = v_member.id
       and l.reason = 'visit'
       and l.visit_id <> v_visit.id
       and v.voided_at is null
       and (v.occurred_at at time zone v_tz)::date = (v_visit.occurred_at at time zone v_tz)::date;
    if v_credited >= v_program.max_visits_per_day then
      return null;
    end if;

    v_points := loyalty.points_for_visit(v_program, v_visit.amount_minor);
    if v_points > 0 and loyalty.post_movement(v_member, v_points, 'visit', v_visit_id) then
      -- Primera visita real del amigo invitado: premio para los dos. Una falla
      -- acá no puede sacarle los puntos de la visita.
      begin
        perform loyalty.reward_referral(v_member, v_visit_id);
      exception
        when others then
          raise warning 'loyalty.reward_referral(%): %', new.id, sqlerrm;
          insert into loyalty.event_failures (business_id, event_id, error)
          values (new.business_id, new.id, left('referral: ' || sqlerrm, 1000));
      end;
    end if;

  elsif new.type = 'visit.voided' then
    select sum(delta) into v_points from loyalty.ledger
     where business_id = new.business_id and visit_id = v_visit_id and reason = 'visit';
    if coalesce(v_points, 0) > 0 then
      perform loyalty.post_movement(v_member, -v_points, 'visit_voided', v_visit_id);
    end if;
    perform loyalty.void_referral_reward(new.business_id, v_visit_id);
  end if;
  return null;
exception
  when others then
    raise warning 'loyalty.handle_core_event(%): %', new.id, sqlerrm;
    begin
      insert into loyalty.event_failures (business_id, event_id, error)
      values (new.business_id, new.id, left(sqlerrm, 1000));
    exception
      when others then
        raise warning 'loyalty.handle_core_event(%): could not record failure: %', new.id, sqlerrm;
    end;
    return null;
end;
$$;

grant execute on function
  loyalty.set_referrer(uuid, text),
  loyalty.referral_ranking(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- CORE · Link de reseñas de Google
-- -----------------------------------------------------------------------------
alter table core.businesses add column google_review_url text
  check (char_length(google_review_url) <= 500
         and google_review_url ~* '^https://(g\.page|(www\.)?google\.(com|com\.[a-z]{2}|[a-z]{2})|maps\.app\.goo\.gl|search\.google\.com)/');
grant update (google_review_url) on core.businesses to authenticated;

-- -----------------------------------------------------------------------------
-- CORE · Opiniones de los clientes (una por visita)
-- -----------------------------------------------------------------------------
create table core.feedback (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  customer_id uuid not null,
  visit_id    uuid not null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, visit_id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete cascade,
  foreign key (business_id, visit_id) references core.visits (business_id, id) on delete restrict
);

create index feedback_business_idx on core.feedback (business_id, created_at desc);
create index feedback_customer_idx on core.feedback (business_id, customer_id);

alter table core.feedback enable row level security;
grant select on core.feedback to authenticated;
create policy feedback_select on core.feedback for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- Interna: guarda la opinión de una visita del cliente (la llama la encuesta de la
-- tarjeta). Solo visitas no anuladas de las últimas 48 h, una vez por visita.
-- Devuelve el link de reseñas para ofrecérselo a todos, sin importar la nota.
create function core.record_feedback(
  p_business_id uuid, p_customer_id uuid, p_visit_id uuid, p_rating integer, p_comment text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit core.visits;
  v_id    uuid;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid rating' using errcode = '22023';
  end if;
  select * into v_visit from core.visits
   where business_id = p_business_id and id = p_visit_id and customer_id = p_customer_id
     and voided_at is null and occurred_at > now() - interval '48 hours';
  if not found then
    raise exception 'visit not found' using errcode = 'P0002';
  end if;

  insert into core.feedback (business_id, customer_id, visit_id, rating, comment)
  values (p_business_id, p_customer_id, p_visit_id, p_rating,
          nullif(left(btrim(coalesce(p_comment, '')), 500), ''))
  on conflict (business_id, visit_id) do nothing
  returning id into v_id;

  if v_id is not null and p_rating <= 3 then
    perform core.emit_event(p_business_id, 'feedback.low',
                            jsonb_build_object('customer_id', p_customer_id, 'visit_id', p_visit_id,
                                               'rating', p_rating));
  end if;

  return jsonb_build_object(
    'reviewUrl', (select google_review_url from core.businesses where id = p_business_id));
end;
$$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
-- El alta por QR puede estar aplicada antes o después que esta.
do $$
begin
  if to_regprocedure('loyalty.self_signup(text,text,text,boolean,boolean)') is not null then
    grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
  end if;
end;
$$;
