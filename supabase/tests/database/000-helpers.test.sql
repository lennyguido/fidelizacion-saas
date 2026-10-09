-- Helpers de test (esquema `tests`). Se crean una vez y los usan los demás archivos.
-- Solo para entornos local/CI. Nunca se aplican como migración.
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
revoke all on schema tests from public;
grant usage on schema tests to anon, authenticated;

-- Crea un usuario de Auth de prueba.
create or replace function tests.create_user(p_email text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_id, p_email);
  return v_id;
end;
$$;

-- Actúa como un usuario autenticado (como lo haría PostgREST con su JWT).
create or replace function tests.authenticate_as(p_user_id uuid) returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function tests.authenticate_as_anon() returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

-- Crea un negocio completo (negocio + sucursal + dueño + módulos del plan piloto).
create or replace function tests.create_business(p_slug text, p_owner uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into core.businesses (name, slug) values ('Test ' || p_slug, p_slug) returning id into v_id;
  insert into core.locations (business_id, name) values (v_id, 'Principal');
  insert into core.memberships (business_id, user_id, role) values (v_id, p_owner, 'owner');
  insert into core.business_modules (business_id, module_id)
  select v_id, module_id from core.plan_modules where plan_id = 'pilot';
  return v_id;
end;
$$;

create or replace function tests.add_member(p_business_id uuid, p_user_id uuid, p_role text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into core.memberships (business_id, user_id, role) values (p_business_id, p_user_id, p_role)
$$;

create or replace function tests.create_customer(p_business_id uuid, p_name text) returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into core.customers (business_id, name) values (p_business_id, p_name) returning id
$$;

-- Carga visitas en el pasado (como una importación) y recalcula estadísticas.
create or replace function tests.backfill_visits(p_customer_id uuid, p_days_ago int[], p_amount bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
  v_location uuid;
  d int;
begin
  select * into v_customer from core.customers where id = p_customer_id;
  select id into v_location from core.locations where business_id = v_customer.business_id limit 1;
  foreach d in array p_days_ago loop
    insert into core.visits (business_id, location_id, customer_id, occurred_at, amount_minor, currency, source)
    values (v_customer.business_id, v_location, p_customer_id, now() - make_interval(days => d),
            p_amount, 'ARS', 'import');
  end loop;
  perform core.refresh_customer_stats(p_customer_id, 'import');
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers loaded');
select * from finish();
