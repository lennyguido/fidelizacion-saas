-- =============================================================================
-- CORE · Resumen de los lunes para el dueño (OPORTUNIDADES #5 y #20).
-- Plan de Claude Code, tarea 5. Decisión D-035.
--
--   core.weekly_digest(negocio) → resumen de la última semana completa
--   (lunes a domingo, en la zona horaria del negocio). Solo dueño o admin.
--
-- Todo lo calcula Postgres; el panel solo lo muestra y arma el texto para
-- "Mandármelo por WhatsApp". Solo agrega funciones: no toca tablas ni datos.
-- =============================================================================

-- Interna: el resumen visto desde el instante p_now (para poder probarlo).
create function core.weekly_digest_at(p_business_id uuid, p_now timestamptz) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business      core.businesses;
  v_week_end_d    date;
  v_week_start    timestamptz;
  v_week_end      timestamptz;
  v_first_visit   timestamptz;
  v_base_weeks    int := 0;
  v_base_start    timestamptz;
  v_visits        int;
  v_identified    int;
  v_base_avg      numeric;
  v_drop          boolean := false;
  v_voids         int;
  v_voids_avg     numeric;
  v_voids_alert   boolean := false;
  v_new           int;
  v_recovered     int;
  v_at_risk       jsonb;
  v_same_staff    jsonb;
  v_automations   boolean;
  v_action        jsonb;
begin
  select * into v_business from core.businesses where id = p_business_id;
  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  -- Semana completa más reciente: del lunes 00:00 al lunes siguiente (hora local).
  v_week_end_d := date_trunc('week', (p_now at time zone v_business.timezone))::date;
  v_week_start := (v_week_end_d - 7)::timestamp at time zone v_business.timezone;
  v_week_end   := v_week_end_d::timestamp at time zone v_business.timezone;

  select min(occurred_at) into v_first_visit
    from core.visits where business_id = p_business_id and voided_at is null;

  -- Semanas anteriores con datos para comparar (entre 4 y 8; con menos no se compara).
  if v_first_visit is not null and v_first_visit < v_week_start then
    v_base_weeks := least(8, floor(extract(epoch from (v_week_start - v_first_visit)) / 604800)::int);
  end if;
  v_base_start := ((v_week_end_d - 7 - 7 * v_base_weeks)::timestamp at time zone v_business.timezone);

  select count(*) filter (where occurred_at >= v_week_start)::int,
         count(*) filter (where occurred_at >= v_week_start and customer_id is not null)::int,
         count(*) filter (where occurred_at < v_week_start)::numeric / nullif(v_base_weeks, 0)
    into v_visits, v_identified, v_base_avg
    from core.visits
   where business_id = p_business_id and voided_at is null
     and occurred_at >= v_base_start and occurred_at < v_week_end;

  if v_base_weeks >= 4 and v_base_avg > 0 then
    v_drop := v_visits < v_base_avg * 0.8;
  else
    v_base_avg := null;
  end if;

  -- Anulaciones fuera de lo normal: 3 o más y más del doble de lo habitual.
  select count(*) filter (where voided_at >= v_week_start)::int,
         count(*) filter (where voided_at < v_week_start)::numeric / nullif(v_base_weeks, 0)
    into v_voids, v_voids_avg
    from core.visits
   where business_id = p_business_id and voided_at is not null
     and voided_at >= v_base_start and voided_at < v_week_end;
  v_voids_alert := v_voids >= 3 and v_voids > 2 * greatest(coalesce(v_voids_avg, 0), 1);

  select count(*)::int into v_new
    from core.customer_stats s
    join core.customers c on c.business_id = s.business_id and c.id = s.customer_id
   where s.business_id = p_business_id and c.status = 'active' and c.anonymized_at is null
     and s.first_visit_at >= v_week_start and s.first_visit_at < v_week_end;

  select count(distinct h.customer_id)::int into v_recovered
    from core.customer_status_history h
   where h.business_id = p_business_id and h.to_status = 'RECOVERED'
     and h.changed_at >= v_week_start and h.changed_at < v_week_end;

  -- 3 habituales (3+ visitas) en riesgo, los que más venían primero.
  select coalesce(jsonb_agg(jsonb_build_object(
           'customerId', x.id, 'name', x.name, 'phone', x.phone,
           'visitCount', x.visit_count, 'lastVisitAt', x.last_visit_at)
           order by x.visit_count desc, x.last_visit_at desc), '[]'::jsonb)
    into v_at_risk
    from (select c.id, c.name, c.phone, s.visit_count, s.last_visit_at
            from core.customer_stats s
            join core.customers c on c.business_id = s.business_id and c.id = s.customer_id
           where s.business_id = p_business_id and s.status = 'AT_RISK' and s.visit_count >= 3
             and c.status = 'active' and c.anonymized_at is null
           order by s.visit_count desc, s.last_visit_at desc
           limit 3) x;

  -- Muchas visitas del mismo cliente cargadas por la misma persona (4+ en la semana).
  select coalesce(jsonb_agg(jsonb_build_object(
           'customerId', x.customer_id, 'customerName', x.name, 'staffEmail', x.email,
           'visits', x.n) order by x.n desc), '[]'::jsonb)
    into v_same_staff
    from (select v.customer_id, c.name, u.email, count(*)::int as n
            from core.visits v
            join core.customers c on c.business_id = v.business_id and c.id = v.customer_id
            left join auth.users u on u.id = v.created_by
           where v.business_id = p_business_id and v.voided_at is null and v.source = 'manual'
             and v.created_by is not null
             and v.occurred_at >= v_week_start and v.occurred_at < v_week_end
           group by v.customer_id, c.name, v.created_by, u.email
          having count(*) >= 4
           order by count(*) desc
           limit 5) x;

  select exists (select 1 from core.automations a
                  where a.business_id = p_business_id and a.enabled)
    into v_automations;

  -- Una sola acción sugerida, la más importante.
  v_action := case
    when v_visits = 0 then jsonb_build_object('kind', 'load_visits')
    when v_voids_alert or jsonb_array_length(v_same_staff) > 0
      then jsonb_build_object('kind', 'review_alerts')
    when jsonb_array_length(v_at_risk) > 0
      then jsonb_build_object('kind', 'contact_at_risk', 'customerId', v_at_risk -> 0 -> 'customerId',
                              'name', v_at_risk -> 0 -> 'name')
    when v_drop and not v_automations and core.has_module(p_business_id, 'recovery')
      then jsonb_build_object('kind', 'turn_on_automations')
    when v_identified * 2 < v_visits then jsonb_build_object('kind', 'ask_phone')
    else jsonb_build_object('kind', 'keep_going')
  end;

  return jsonb_build_object(
    'weekStart', v_week_end_d - 7,
    'weekEnd', v_week_end_d - 1,
    'businessPhone', v_business.phone,
    'visits', v_visits,
    'identifiedVisits', v_identified,
    'baselineVisits', round(v_base_avg, 1),
    'baselineWeeks', case when v_base_avg is null then 0 else v_base_weeks end,
    'visitsDropAlert', v_drop,
    'newCustomers', v_new,
    'recoveredCustomers', v_recovered,
    'atRiskRegulars', v_at_risk,
    'sameStaffAlerts', v_same_staff,
    'voids', v_voids,
    'voidsAlert', v_voids_alert,
    'action', v_action
  );
end;
$$;

create function core.weekly_digest(p_business_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  return core.weekly_digest_at(p_business_id, now());
end;
$$;

grant execute on function core.weekly_digest(uuid) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
