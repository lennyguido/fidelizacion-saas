-- =============================================================================
-- CORE · Índices para foreign keys (recomendación del linter de Supabase).
-- Evitan escaneos completos al validar o borrar filas referenciadas.
-- =============================================================================

create index visits_location_idx on core.visits (business_id, location_id);
create index visits_created_by_idx on core.visits (created_by) where created_by is not null;
create index visits_voided_by_idx on core.visits (voided_by) where voided_by is not null;
create index customers_created_by_idx on core.customers (created_by) where created_by is not null;
create index customer_consents_recorded_by_idx on core.customer_consents (recorded_by)
  where recorded_by is not null;
create index business_modules_module_idx on core.business_modules (module_id);
create index plan_modules_module_idx on core.plan_modules (module_id);
create index subscriptions_plan_idx on core.subscriptions (plan_id);

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
