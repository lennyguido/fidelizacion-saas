-- Verificación en un Postgres de PRUEBA (no Supabase): quitar EXECUTE a
-- public.rls_auto_enable() no impide que el event trigger active RLS.
-- Uso: createdb evt_proof && psql -X -v ON_ERROR_STOP=0 -d evt_proof -f scripts/verify-rls-auto-enable-local.sql && dropdb evt_proof
-- Copia de la definición de Supabase (2026-10-09), reducida a lo esencial.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path to 'pg_catalog' as $$
declare cmd record; tbl name;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
              where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
                and object_type in ('table', 'partitioned table') loop
    if cmd.schema_name = 'public' then
      select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
      execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
    end if;
  end loop;
end $$;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
create role app_user login;
grant create on schema public to app_user;

\echo '1) Llamarla directo (como intentaría la API) — se espera ERROR:'
select public.rls_auto_enable();

\echo '2) Quitar el permiso de ejecutar a todos los roles comunes:'
revoke execute on function public.rls_auto_enable() from public;
select has_function_privilege('app_user', 'public.rls_auto_enable()', 'execute') as app_user_puede_ejecutar;

\echo '3) Un usuario común crea una tabla en public — se espera rls_activado = t:'
set role app_user;
create table public.prueba (id int);
reset role;
select relname, relrowsecurity as rls_activado from pg_class where relname = 'prueba';
