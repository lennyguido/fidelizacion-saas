-- =============================================================================
-- CORE · Búsqueda de clientes para el mostrador y el listado (TASKS.md §18).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Búsqueda parcial por nombre (ILIKE '%texto%') usando índice trigram.
create index customers_name_trgm_idx on core.customers
  using gin (name extensions.gin_trgm_ops);

-- Búsqueda por teléfono: los dígitos sin el "+" para poder buscar "2233" o "1122334455".
create index customers_phone_trgm_idx on core.customers
  using gin (phone extensions.gin_trgm_ops) where phone is not null;

-- Busca clientes activos del negocio por nombre, teléfono o email.
-- SECURITY INVOKER: RLS se aplica con los permisos de quien consulta.
-- Sin texto, devuelve los que vinieron más recientemente.
create function core.search_customers(
  p_business_id uuid,
  p_query       text default null,
  p_status      text default null,
  p_limit       integer default 20,
  p_offset      integer default 0
) returns table (
  id             uuid,
  name           text,
  phone          text,
  email          text,
  status         text,
  risk_score     smallint,
  visit_count    integer,
  last_visit_at  timestamptz,
  total_spend_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as text,
      -- escapar comodines de LIKE que pueda escribir el usuario
      '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      nullif(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '') as digits
  )
  select c.id, c.name, c.phone, c.email, s.status, s.risk_score, s.visit_count,
         s.last_visit_at, s.total_spend_minor
    from core.customers c
    join core.customer_stats s on s.customer_id = c.id
    cross join q
   where c.business_id = p_business_id
     and c.status = 'active'
     and (p_status is null or s.status = p_status)
     and (
       q.text is null
       or c.name ilike q.pattern
       or c.email ilike q.pattern
       or (q.digits is not null and char_length(q.digits) >= 3 and c.phone like '%' || q.digits || '%')
     )
   order by
     (q.text is not null and c.name ilike btrim(p_query) || '%') desc,
     s.last_visit_at desc nulls last,
     c.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

grant execute on function core.search_customers(uuid, text, text, integer, integer) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
