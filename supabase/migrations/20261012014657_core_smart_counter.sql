-- =============================================================================
-- CORE · Mostrador inteligente (OPORTUNIDADES #15, #19 y #14). Plan de Claude
-- Code, tarea 8. Decisión D-038.
--
--   core.customer_snapshot(cliente)  → "Ana · hace 2 años · visita 50 · viene
--       cada ~9 días" + nota corta. Cualquier miembro del equipo. El valor en
--       pesos (lo que gastó, solo con montos cargados) solo lo ve dueño/admin.
--   core.team_week_stats(negocio)    → ranking del equipo en la semana (lunes a
--       hoy, hora del negocio): visitas registradas y clientes dados de alta por
--       persona. El dueño/admin ve todos los números; un empleado ve el orden y
--       solo sus propios números.
--   core.top_customers(negocio)      → los 10 clientes que más vinieron en los
--       últimos 90 días, con lo que gastaron (dueño/admin).
--
-- Solo agrega funciones: no toca tablas ni datos. Nada para anon.
-- =============================================================================

create function core.customer_snapshot(p_customer_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
  v_stats    core.customer_stats;
  v_since    timestamptz;
  v_manager  boolean;
begin
  select * into v_customer from core.customers where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_customer.business_id);
  v_manager := core.has_role(v_customer.business_id, array['owner', 'admin']);
  select * into v_stats from core.customer_stats
   where customer_id = v_customer.id and business_id = v_customer.business_id;
  v_since := least(v_customer.created_at, coalesce(v_stats.first_visit_at, v_customer.created_at));

  return jsonb_build_object(
    'customerId', v_customer.id,
    'name', v_customer.name,
    'customerSince', v_since,
    'visitCount', coalesce(v_stats.visit_count, 0),
    'nextVisitNumber', coalesce(v_stats.visit_count, 0) + 1,
    'medianIntervalDays', round(v_stats.median_interval_days),
    'lastVisitAt', v_stats.last_visit_at,
    'status', v_stats.status,
    'note', nullif(left(btrim(coalesce(v_customer.notes, '')), 80), ''),
    -- Solo con montos cargados; si no hay, null (no se inventa).
    'totalSpendMinor', case when v_manager and coalesce(v_stats.spend_visit_count, 0) > 0
                            then v_stats.total_spend_minor end,
    'spendVisitCount', case when v_manager then coalesce(v_stats.spend_visit_count, 0) end
  );
end;
$$;

create function core.team_week_stats(p_business_id uuid)
returns table (user_id uuid, email text, role text, is_me boolean, visits integer, new_customers integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz         text;
  v_week_start timestamptz;
  v_manager    boolean;
begin
  perform core.require_member(p_business_id);
  v_manager := core.has_role(p_business_id, array['owner', 'admin']);
  select timezone into v_tz from core.businesses where id = p_business_id;
  v_week_start := date_trunc('week', now() at time zone v_tz) at time zone v_tz;

  return query
    with team as (
      select m.user_id, u.email::text as email, m.role
        from core.memberships m
        join auth.users u on u.id = m.user_id
       where m.business_id = p_business_id and m.status = 'active'
    ), v as (
      select created_by, count(*)::int as n from core.visits
       where business_id = p_business_id and voided_at is null
         and occurred_at >= v_week_start and created_by is not null
       group by created_by
    ), c as (
      select created_by, count(*)::int as n from core.customers
       where business_id = p_business_id and created_at >= v_week_start
         and created_by is not null
       group by created_by
    )
    select t.user_id,
           t.email,
           t.role,
           t.user_id = (select auth.uid()),
           case when v_manager or t.user_id = (select auth.uid()) then coalesce(v.n, 0) end,
           case when v_manager or t.user_id = (select auth.uid()) then coalesce(c.n, 0) end
      from team t
      left join v on v.created_by = t.user_id
      left join c on c.created_by = t.user_id
     order by coalesce(v.n, 0) desc, coalesce(c.n, 0) desc, t.email;
end;
$$;

create function core.top_customers(p_business_id uuid)
returns table (customer_id uuid, name text, visits integer, spend_minor bigint, last_visit_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  return query
    select c.id, c.name, count(v.id)::int,
           -- Solo con montos cargados; si no hay ninguno, null.
           case when count(v.amount_minor) > 0 then sum(v.amount_minor)::bigint end,
           max(v.occurred_at)
      from core.visits v
      join core.customers c on c.business_id = v.business_id and c.id = v.customer_id
     where v.business_id = p_business_id and v.voided_at is null
       and v.occurred_at >= now() - interval '90 days'
       and c.status = 'active' and c.anonymized_at is null
     group by c.id, c.name
     order by 3 desc, 4 desc nulls last, c.name
     limit 10;
end;
$$;

grant execute on function
  core.customer_snapshot(uuid),
  core.team_week_stats(uuid),
  core.top_customers(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
