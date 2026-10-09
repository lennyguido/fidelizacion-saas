-- =============================================================================
-- CORE · Limpieza periódica para que tablas internas no crezcan sin límite.
-- =============================================================================

-- Borra eventos ya procesados hace más de 30 días y cualquier evento de más de un
-- año, y el historial de ejecuciones de pg_cron de más de 30 días.
create function core.cleanup_old_records() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events integer;
  v_cron   integer := 0;
begin
  delete from core.events
   where (processed_at is not null and processed_at < now() - interval '30 days')
      or occurred_at < now() - interval '365 days';
  get diagnostics v_events = row_count;

  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''30 days''';
    get diagnostics v_cron = row_count;
  end if;

  return jsonb_build_object('events_deleted', v_events, 'cron_runs_deleted', v_cron);
end;
$$;

-- Domingos 04:00 hora Argentina (07:00 UTC).
do $outer$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron not installed: skipping cleanup job';
    return;
  end if;
  perform cron.schedule('core-cleanup-old-records', '0 7 * * 0', 'select core.cleanup_old_records()');
end
$outer$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
