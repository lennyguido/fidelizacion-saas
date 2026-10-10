-- =============================================================================
-- LOYALTY · Endurecimiento del módulo de puntos (revisión de seguridad).
--
-- Problema: alguien del equipo podía "fabricar" puntos cargando visitas con fecha
-- atrasada (el núcleo acepta hasta 7 días atrás y el control de doble carga de
-- 120 s se esquiva cambiando la hora) y con montos enormes, y después canjearlos.
--
-- Reglas nuevas (solo en loyalty; el núcleo no cambia):
--   * Solo suman puntos las visitas cargadas en el momento: la hora de la visita
--     tiene que ser como mucho 30 minutos antes de la carga. Una visita cargada
--     tarde (o atrasada) se registra igual en el núcleo, pero no da puntos.
--   * Tope de puntos por visita (max_points_per_visit, por defecto 1.000).
--   * Tope de visitas que suman por día (max_visits_per_day, por defecto 3), por
--     socio, contando el día en la zona horaria del negocio. Las visitas anuladas
--     no cuentan para el tope.
--   * Las fallas al procesar un evento quedan guardadas en loyalty.event_failures
--     (solo visible con la service role), y el trigger sigue sin lanzar errores.
--   * La tarjeta digital no se muestra si el cliente está archivado o anonimizado,
--     y salir del programa borra el link (si vuelve, hay que generar uno nuevo).
-- Migración no destructiva: agrega columnas con default y reemplaza funciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Topes del programa
-- -----------------------------------------------------------------------------
alter table loyalty.programs
  add column max_visits_per_day integer not null default 3
    check (max_visits_per_day between 1 and 50),
  add column max_points_per_visit integer not null default 1000
    check (max_points_per_visit between 1 and 100000);

grant insert (max_visits_per_day, max_points_per_visit),
      update (max_visits_per_day, max_points_per_visit)
  on loyalty.programs to authenticated;

-- -----------------------------------------------------------------------------
-- Registro de fallas del trigger (sin permisos ni policies: solo service role)
-- -----------------------------------------------------------------------------
create table loyalty.event_failures (
  id          bigint generated always as identity primary key,
  business_id uuid not null references core.businesses (id) on delete restrict,
  event_id    bigint,
  error       text,
  created_at  timestamptz not null default now()
);
create index event_failures_business_idx on loyalty.event_failures (business_id, created_at);
alter table loyalty.event_failures enable row level security;
revoke all on loyalty.event_failures from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Puntos de una visita: ahora con el tope del programa.
-- -----------------------------------------------------------------------------
create or replace function loyalty.points_for_visit(p_program loyalty.programs, p_amount_minor bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select least(coalesce(p_program.max_points_per_visit, 100000), 100000,
    p_program.points_per_visit
    + case
        when p_program.points_per_amount > 0
         and p_amount_minor is not null
         and p_amount_minor >= p_program.min_amount_minor
        then (p_amount_minor / p_program.amount_step_minor) * p_program.points_per_amount
        else 0
      end)::bigint
$$;

-- -----------------------------------------------------------------------------
-- Reacción a los eventos del núcleo. Nunca lanza errores.
-- Lee la visita desde core.visits (hora, monto, origen) en lugar de confiar en
-- el payload del evento.
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

-- -----------------------------------------------------------------------------
-- Salir del programa: además borra el link de la tarjeta.
-- -----------------------------------------------------------------------------
create or replace function loyalty.leave_program(p_member_id uuid) returns loyalty.members
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

  delete from loyalty.cards where member_id = p_member_id;

  if v_member.status = 'left' then
    return v_member;
  end if;
  update loyalty.members set status = 'left', left_at = now() where id = p_member_id
  returning * into v_member;
  return v_member;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tarjeta digital: null también si el cliente está archivado o anonimizado.
-- -----------------------------------------------------------------------------
create or replace function loyalty.get_card(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member   loyalty.members;
  v_business core.businesses;
  v_customer core.customers;
  v_program  loyalty.programs;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select m.* into v_member
    from loyalty.cards c join loyalty.members m on m.id = c.member_id
   where c.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found or v_member.status <> 'active' or not core.has_module(v_member.business_id, 'loyalty') then
    return null;
  end if;
  select * into v_customer from core.customers
   where id = v_member.customer_id and business_id = v_member.business_id;
  if not found or v_customer.status <> 'active' or v_customer.anonymized_at is not null then
    return null;
  end if;
  select * into v_business from core.businesses where id = v_member.business_id;
  select * into v_program from loyalty.programs where business_id = v_member.business_id;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'name', v_business.name, 'slug', v_business.slug, 'currency', v_business.currency,
      'primaryColor', v_business.primary_color, 'logoPath', v_business.logo_path),
    'firstName', split_part(btrim(v_customer.name), ' ', 1),
    'memberCode', v_member.member_code,
    'pointsBalance', v_member.points_balance,
    'lifetimePoints', v_member.lifetime_points,
    'joinedAt', v_member.joined_at,
    'program', case when v_program.business_id is null then null else jsonb_build_object(
      'enabled', v_program.enabled, 'kind', v_program.kind,
      'pointsPerVisit', v_program.points_per_visit, 'pointsPerAmount', v_program.points_per_amount,
      'amountStepMinor', v_program.amount_step_minor, 'minAmountMinor', v_program.min_amount_minor) end,
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description,
                                          'costPoints', r.cost_points) order by r.cost_points)
        from loyalty.rewards r
       where r.business_id = v_member.business_id and r.active
         and (r.available_until is null or r.available_until > now())), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'createdAt', l.created_at)
                       order by l.created_at desc, l.id desc)
        from (select * from loyalty.ledger
               where business_id = v_member.business_id and member_id = v_member.id
               order by created_at desc, id desc limit 10) l), '[]'::jsonb)
  );
end;
$$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
