-- Meta-test de seguridad: se aplica a TODAS las tablas y funciones de los esquemas
-- de la plataforma. Si alguien agrega una tabla o función sin la protección
-- correspondiente, este test falla. Ver docs/ARCHITECTURE.md §3.5.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- Esquemas de la plataforma (agregar acá cada módulo nuevo).
create temp table platform_schemas (name text primary key) on commit drop;
insert into platform_schemas values ('core'), ('loyalty'), ('recovery'), ('booking'), ('reputation'), ('seller');

-- Tablas globales que no pertenecen a un negocio.
create temp table global_tables (name text primary key) on commit drop;
insert into global_tables values
  ('core.businesses'), ('core.platform_admins'), ('core.modules'), ('core.plans'), ('core.plan_modules');

-- 1. Toda tabla tiene RLS habilitado.
select is_empty(
  $$ select n.nspname || '.' || c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n.nspname in (select name from platform_schemas)
        and not c.relrowsecurity $$,
  'every platform table has RLS enabled'
);

-- 2. Toda tabla de negocio tiene business_id NOT NULL.
select is_empty(
  $$ select n.nspname || '.' || c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n.nspname in (select name from platform_schemas)
        and n.nspname || '.' || c.relname not in (select name from global_tables)
        and not exists (
          select 1 from pg_attribute a
           where a.attrelid = c.oid and a.attname = 'business_id' and a.attnotnull and not a.attisdropped
        ) $$,
  'every business table has business_id not null'
);

-- 3. Toda tabla de negocio tiene un índice que empieza por business_id.
select is_empty(
  $$ select n.nspname || '.' || c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and n.nspname in (select name from platform_schemas)
        and n.nspname || '.' || c.relname not in (select name from global_tables)
        and not exists (
          select 1 from pg_index i
            join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
           where i.indrelid = c.oid and a.attname = 'business_id'
        ) $$,
  'every business table has an index starting with business_id'
);

-- 4. anon no puede ejecutar ninguna función de la plataforma.
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in (select name from platform_schemas)
        and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon cannot execute platform functions'
);

-- 5. Ninguna función queda ejecutable por PUBLIC (default de Postgres).
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in (select name from platform_schemas)
        and (p.proacl is null
             or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'no platform function is executable by PUBLIC'
);

-- 6. Las funciones que puede llamar un usuario son exactamente las previstas.
select set_eq(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in (select name from platform_schemas)
        and has_function_privilege('authenticated', p.oid, 'execute') $$,
  $$ values
       ('core.my_business_ids()'),
       ('core.my_business_ids_with_role(text[])'),
       ('core.my_business_ids_with_module(text)'),
       ('core.my_customer_ids()'),
       ('core.is_member(uuid)'),
       ('core.has_role(uuid,text[])'),
       ('core.has_module(uuid,text)'),
       ('core.is_platform_admin()'),
       ('core.record_visit(uuid,uuid,uuid,bigint,timestamp with time zone,text,text,text)'),
       ('core.void_visit(uuid,text)'),
       ('core.is_slug_available(text)'),
       ('core.create_business(text,text,text)') $$,
  'authenticated can execute only the intended functions'
);

-- 7. Toda función SECURITY DEFINER fija su search_path.
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in (select name from platform_schemas)
        and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'every security definer function pins search_path'
);

-- 8. Las vistas respetan los permisos de quien consulta (security_invoker).
select is_empty(
  $$ select n.nspname || '.' || c.relname
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'v' and n.nspname in (select name from platform_schemas)
        and not coalesce('security_invoker=true' = any (c.reloptions), false) $$,
  'every platform view uses security_invoker'
);

select * from finish();
rollback;
