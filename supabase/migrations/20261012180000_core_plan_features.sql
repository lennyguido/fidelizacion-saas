-- =============================================================================
-- CORE · Funciones y límites por plan (D-044, no destructivo).
--
-- Cada plan dice qué funciones incluye y cuántos clientes, personas del equipo y
-- sucursales permite (core.plans.features). Se aplica en la base, no en la
-- pantalla:
--   * automations   → recuperación automática (encender y que el motor corra)
--   * self_signup   → alta por QR (encenderla y que el cartel funcione)
--   * cash_register → conexión con la caja (claves, ventas y simulador)
--   * max_customers / max_staff (sin contar al dueño) / max_locations
--     (null = sin límite)
-- El piloto y los negocios que ya existen tienen todo, sin límites.
-- =============================================================================

alter table core.plans add column features jsonb not null default '{}'::jsonb
  check (jsonb_typeof(features) = 'object');

update core.plans set features = case id
  when 'barrio' then '{"automations": false, "self_signup": false, "cash_register": false,
                       "max_customers": 1000, "max_staff": 2, "max_locations": 1}'::jsonb
  when 'local'  then '{"automations": true, "self_signup": true, "cash_register": false,
                       "max_customers": 5000, "max_staff": 5, "max_locations": 1}'::jsonb
  when 'cadena' then '{"automations": true, "self_signup": true, "cash_register": true,
                       "max_customers": 20000, "max_staff": null, "max_locations": 5}'::jsonb
  else '{"automations": true, "self_signup": true, "cash_register": true,
         "max_customers": null, "max_staff": null, "max_locations": null}'::jsonb
end;

-- -----------------------------------------------------------------------------
-- Lectura (internas, sin grant): plan vigente del negocio y sus funciones.
-- -----------------------------------------------------------------------------
create function core.business_plan(p_business_id uuid) returns core.plans
language sql
stable
security definer
set search_path = ''
as $$
  -- Sin suscripción vigente (negocios de ejemplo o anteriores): el piloto.
  select p.* from core.plans p
   where p.id = coalesce(
     (select s.plan_id from core.subscriptions s
       where s.business_id = p_business_id and s.status in ('trialing', 'active', 'past_due')
       order by s.created_at desc
       limit 1),
     'pilot')
$$;

create function core.has_feature(p_business_id uuid, p_feature text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(((core.business_plan(p_business_id)).features ->> p_feature)::boolean, false)
$$;

-- Límite numérico del plan; null = sin límite.
create function core.plan_limit(p_business_id uuid, p_limit text) returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select ((core.business_plan(p_business_id)).features ->> p_limit)::integer
$$;

create function core.require_feature(p_business_id uuid, p_feature text) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not core.has_feature(p_business_id, p_feature) then
    perform core.raise_forbidden('plan_feature_required: ' || p_feature);
  end if;
end;
$$;

-- Para el panel (cualquier miembro): plan, funciones y cuánto se usa de cada límite.
create function core.my_plan(p_business_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan core.plans;
begin
  perform core.require_member(p_business_id);
  v_plan := core.business_plan(p_business_id);
  return jsonb_build_object(
    'planId', v_plan.id,
    'name', v_plan.name,
    'features', coalesce(v_plan.features, '{}'::jsonb),
    'usage', jsonb_build_object(
      'customers', (select count(*) from core.customers where business_id = p_business_id),
      'staff', (select count(*) from core.memberships
                 where business_id = p_business_id and role <> 'owner' and status = 'active'),
      'locations', (select count(*) from core.locations where business_id = p_business_id)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Límites: clientes, equipo y sucursales.
-- -----------------------------------------------------------------------------
create function core.enforce_plan_limits() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
  v_key   text;
begin
  if tg_table_name = 'customers' then
    v_key := 'max_customers';
    v_limit := core.plan_limit(new.business_id, v_key);
    if v_limit is not null then
      select count(*) into v_count from core.customers where business_id = new.business_id;
    end if;
  elsif tg_table_name = 'memberships' then
    if new.role = 'owner' then
      return new;
    end if;
    v_key := 'max_staff';
    v_limit := core.plan_limit(new.business_id, v_key);
    if v_limit is not null then
      select count(*) into v_count from core.memberships
       where business_id = new.business_id and role <> 'owner' and status = 'active';
    end if;
  else
    v_key := 'max_locations';
    v_limit := core.plan_limit(new.business_id, v_key);
    if v_limit is not null then
      select count(*) into v_count from core.locations where business_id = new.business_id;
    end if;
  end if;
  if v_limit is not null and v_count >= v_limit then
    raise exception 'plan_limit_reached: %', v_key using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger customers_plan_limit before insert on core.customers
  for each row execute function core.enforce_plan_limits();
create trigger memberships_plan_limit before insert on core.memberships
  for each row execute function core.enforce_plan_limits();
create trigger locations_plan_limit before insert on core.locations
  for each row execute function core.enforce_plan_limits();

-- -----------------------------------------------------------------------------
-- Recuperación automática: solo planes con 'automations'.
-- -----------------------------------------------------------------------------
create or replace function core.set_automation(
  p_business_id      uuid,
  p_kind             text,
  p_enabled          boolean,
  p_days             integer,
  p_message          text,
  p_benefit          text default null,
  p_control_pct      integer default 10,
  p_attribution_days integer default 14
) returns core.automations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row core.automations;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  if coalesce(p_enabled, false) then
    perform core.require_feature(p_business_id, 'automations');
  end if;
  if p_kind is null or p_kind not in ('at_risk', 'second_visit', 'birthday') then
    raise exception 'invalid automation' using errcode = '22023';
  end if;
  if p_enabled is null or not core.automation_days_valid(p_kind, p_days) then
    raise exception 'invalid automation days' using errcode = '22023';
  end if;

  insert into core.automations (business_id, kind, enabled, days, message, benefit,
                                control_pct, attribution_days, updated_by)
  values (p_business_id, p_kind, p_enabled, p_days, btrim(p_message), nullif(btrim(p_benefit), ''),
          p_control_pct, p_attribution_days, (select auth.uid()))
  on conflict (business_id, kind) do update
    set enabled = excluded.enabled, days = excluded.days, message = excluded.message,
        benefit = excluded.benefit, control_pct = excluded.control_pct,
        attribution_days = excluded.attribution_days, updated_by = excluded.updated_by
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function core.run_automations(p_now timestamptz default now()) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation core.automations;
  v_total      integer := 0;
begin
  for v_automation in
    select a.* from core.automations a
     where a.enabled and core.has_module(a.business_id, 'recovery')
       and core.has_feature(a.business_id, 'automations')
     order by a.business_id, a.kind
  loop
    begin
      v_total := v_total + core.run_automation(v_automation, p_now);
    exception when others then
      raise warning 'core.run_automations: % / %: %', v_automation.business_id, v_automation.kind, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;

create or replace function core.run_business_automations(p_business_id uuid) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation core.automations;
  v_total      integer := 0;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  perform core.require_feature(p_business_id, 'automations');
  for v_automation in
    select a.* from core.automations a
     where a.business_id = p_business_id and a.enabled
     order by a.kind
  loop
    v_total := v_total + core.run_automation(v_automation, now());
  end loop;
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alta por QR: solo planes con 'self_signup' (para encenderla y para que funcione).
-- -----------------------------------------------------------------------------
create or replace function core.set_self_signup(p_business_id uuid, p_enabled boolean)
returns core.self_signup_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings core.self_signup_settings;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if p_enabled is null then
    raise exception 'enabled is required' using errcode = '22023';
  end if;
  if p_enabled then
    perform core.require_feature(p_business_id, 'self_signup');
  end if;
  insert into core.self_signup_settings (business_id, enabled, code)
  values (p_business_id, p_enabled, core.new_self_signup_code())
  on conflict (business_id) do update set enabled = excluded.enabled
  returning * into v_settings;
  return v_settings;
end;
$$;

create or replace function core.self_signup_business(p_code text) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.business_id
    from core.self_signup_settings s
    join core.businesses b on b.id = s.business_id
   where s.code = core.normalize_self_signup_code(p_code)
     and s.enabled
     and b.status = 'active'
     and core.has_feature(s.business_id, 'self_signup')
$$;

-- -----------------------------------------------------------------------------
-- Conexión con la caja: solo planes con 'cash_register'.
-- -----------------------------------------------------------------------------
create or replace function core.integration_key_for(p_key_hash text) returns core.integration_keys
language sql
stable
set search_path = ''
as $$
  select k.* from core.integration_keys k
    join core.businesses b on b.id = k.business_id
   where k.key_hash = p_key_hash and k.revoked_at is null and b.status = 'active'
     and core.has_feature(k.business_id, 'cash_register')
$$;

create or replace function core.create_integration_key(
  p_business_id uuid, p_name text, p_location_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'lk_' || encode(extensions.gen_random_bytes(20), 'hex');
  v_id  uuid;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform core.require_feature(p_business_id, 'cash_register');
  if p_location_id is not null and not exists (
       select 1 from core.locations where business_id = p_business_id and id = p_location_id) then
    raise exception 'location not found' using errcode = 'P0002';
  end if;
  insert into core.integration_keys (business_id, location_id, name, key_prefix, key_hash, created_by)
  values (p_business_id, p_location_id, btrim(coalesce(p_name, '')), left(v_key, 9),
          encode(extensions.digest(v_key, 'sha256'), 'hex'), (select auth.uid()))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', left(v_key, 9));
end;
$$;

create or replace function core.simulate_sale(p_business_id uuid, p_amount_minor bigint, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform core.require_feature(p_business_id, 'cash_register');
  return core.ingest_sale_for(p_business_id, null,
                              'PRUEBA-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
                              p_amount_minor, null, nullif(btrim(p_phone), ''), null);
end;
$$;

grant execute on function core.my_plan(uuid) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
