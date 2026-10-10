-- =============================================================================
-- CORE · Permitir que dueño/admin cambien la zona horaria del negocio.
--
-- Los triggers businesses_validate y locations_validate corren con los permisos
-- de quien hace el UPDATE y llaman a core.is_valid_timezone(). Esa función no
-- tenía GRANT para `authenticated`, así que cambiar la zona horaria desde
-- "Mi negocio" fallaba con "permission denied for function is_valid_timezone".
-- (create_business no lo notaba porque es SECURITY DEFINER.)
--
-- is_valid_timezone solo consulta pg_timezone_names: no lee ni escribe datos.
-- No destructiva: solo agrega un permiso.
-- =============================================================================

grant execute on function core.is_valid_timezone(text) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
