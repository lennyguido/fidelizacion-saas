-- =============================================================================
-- CORE · Auditoría genérica, storage de logos y jobs programados.
-- Ver docs/ARCHITECTURE.md §11 y §12.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auditoría: un trigger reutilizable por cualquier tabla de cualquier módulo.
--   create trigger <tabla>_audit after insert or update or delete on <tabla>
--     for each row execute function core.audit_row();
-- -----------------------------------------------------------------------------

create table core.audit_log (
  id          bigint generated always as identity primary key,
  business_id uuid not null references core.businesses (id) on delete restrict,
  actor_id    uuid,
  table_name  text not null,
  record_id   text,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz not null default now()
);

create index audit_log_business_idx on core.audit_log (business_id, changed_at desc);
create index audit_log_record_idx on core.audit_log (business_id, table_name, record_id);

create function core.audit_row() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_business_id uuid;
  v_changed_old jsonb;
  v_changed_new jsonb;
begin
  v_business_id := case
    when tg_table_schema = 'core' and tg_table_name = 'businesses' then (v_row ->> 'id')::uuid
    else (v_row ->> 'business_id')::uuid
  end;

  if tg_op = 'UPDATE' then
    -- Solo las columnas que cambiaron.
    select jsonb_object_agg(key, v_old -> key), jsonb_object_agg(key, value)
      into v_changed_old, v_changed_new
      from jsonb_each(v_new)
     where key <> 'updated_at' and v_old -> key is distinct from value;
    if v_changed_new is null then
      return null;
    end if;
    v_old := v_changed_old;
    v_new := v_changed_new;
  end if;

  insert into core.audit_log (business_id, actor_id, table_name, record_id, action, old_data, new_data)
  values (
    v_business_id,
    (select auth.uid()),
    tg_table_schema || '.' || tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'customer_id', v_row ->> 'module_id'),
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

create trigger businesses_audit after update on core.businesses
  for each row execute function core.audit_row();
create trigger locations_audit after insert or update on core.locations
  for each row execute function core.audit_row();
create trigger memberships_audit after insert or update or delete on core.memberships
  for each row execute function core.audit_row();
create trigger subscriptions_audit after insert or update on core.subscriptions
  for each row execute function core.audit_row();
create trigger business_modules_audit after insert or update or delete on core.business_modules
  for each row execute function core.audit_row();
create trigger customers_audit after update on core.customers
  for each row execute function core.audit_row();
create trigger visits_audit after update on core.visits
  for each row execute function core.audit_row();

alter table core.audit_log enable row level security;
grant select on core.audit_log to authenticated;

create policy audit_log_select on core.audit_log
  for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- -----------------------------------------------------------------------------
-- Storage: bucket público de logos, ruta obligatoria "{business_id}/archivo".
-- Solo existe en Supabase; en otros Postgres se omite.
-- -----------------------------------------------------------------------------

do $outer$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present: skipping logos bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logos', 'logos', true, 1048576,
          array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
  on conflict (id) do nothing;

  execute $sql$
    create policy logos_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] in (
          select id::text from core.my_business_ids_with_role(array['owner', 'admin']) id
        )
      )
  $sql$;

  execute $sql$
    create policy logos_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] in (
          select id::text from core.my_business_ids_with_role(array['owner', 'admin']) id
        )
      )
  $sql$;

  execute $sql$
    create policy logos_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] in (
          select id::text from core.my_business_ids_with_role(array['owner', 'admin']) id
        )
      )
  $sql$;
end
$outer$;

-- -----------------------------------------------------------------------------
-- Job nocturno: recalcular estado y riesgo de clientes (03:00 hora Argentina).
-- -----------------------------------------------------------------------------

do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping scheduled jobs';
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.schedule(
    'core-refresh-customer-statuses',
    '0 6 * * *',
    'select core.refresh_statuses()'
  );
end
$outer$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
