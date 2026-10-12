-- =============================================================================
-- CORE · Estadísticas para el dueño (página "Estadísticas"). Decisión D-042.
--
--   core.business_stats(negocio, días) → todo lo que dibuja la página, calculado
--   acá (el panel no calcula nada): totales del período y del período anterior,
--   serie diaria, visitas por semana y por origen, nuevos contra recurrentes y
--   visitas por día de la semana. Fechas en la zona horaria del negocio.
--   Solo dueño o admin. Solo agrega una función.
-- =============================================================================

create function core.business_stats(p_business_id uuid, p_days integer default 30) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz         text;
  v_today      date;
  v_from       date;
  v_prev_from  date;
  v_start      timestamptz;
  v_prev_start timestamptz;
  v_end        timestamptz;
  v_result     jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if p_days is null or p_days not in (7, 30, 90, 180, 365) then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select timezone into v_tz from core.businesses where id = p_business_id;
  v_today      := (now() at time zone v_tz)::date;
  v_from       := v_today - (p_days - 1);
  v_prev_from  := v_from - p_days;
  v_start      := v_from::timestamp at time zone v_tz;
  v_prev_start := v_prev_from::timestamp at time zone v_tz;
  v_end        := (v_today + 1)::timestamp at time zone v_tz;

  with v as (
    select (occurred_at at time zone v_tz)::date as day, occurred_at, customer_id,
           amount_minor, source
      from core.visits
     where business_id = p_business_id and voided_at is null
       and occurred_at >= v_prev_start and occurred_at < v_end
  ), cur as (select * from v where occurred_at >= v_start),
  prev as (select * from v where occurred_at < v_start),
  firsts as (
    -- Primera visita de cada cliente (de toda la historia) para separar nuevos de recurrentes.
    select customer_id, min(occurred_at) as first_at
      from core.visits
     where business_id = p_business_id and voided_at is null and customer_id is not null
     group by customer_id
  ),
  totals as (
    select
      (select count(*) from cur)::int as visits,
      (select count(*) from prev)::int as visits_prev,
      (select count(distinct customer_id) from cur)::int as customers,
      (select count(distinct customer_id) from prev)::int as customers_prev,
      (select count(*) filter (where customer_id is not null) from cur)::int as identified,
      (select count(*) filter (where customer_id is not null) from prev)::int as identified_prev,
      (select avg(amount_minor) from cur where amount_minor is not null) as avg_ticket,
      (select avg(amount_minor) from prev where amount_minor is not null) as avg_ticket_prev,
      (select coalesce(sum(amount_minor), 0) from cur)::bigint as revenue,
      (select coalesce(sum(amount_minor), 0) from prev)::bigint as revenue_prev
  )
  select jsonb_build_object(
    'from', v_from,
    'to', v_today,
    'days', p_days,
    'totals', (select jsonb_build_object(
        'visits', visits, 'visitsPrev', visits_prev,
        'customers', customers, 'customersPrev', customers_prev,
        'identified', identified, 'identifiedPrev', identified_prev,
        'avgTicketMinor', round(avg_ticket), 'avgTicketPrevMinor', round(avg_ticket_prev),
        'revenueMinor', revenue, 'revenuePrevMinor', revenue_prev) from totals),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'visits', coalesce(x.visits, 0), 'customers', coalesce(x.customers, 0),
        'identified', coalesce(x.identified, 0), 'avgTicketMinor', x.avg_ticket)
        order by d.day), '[]'::jsonb)
      from (select generate_series(v_from, v_today, interval '1 day')::date as day) d
      left join (select day, count(*)::int as visits, count(distinct customer_id)::int as customers,
                        count(customer_id)::int as identified, round(avg(amount_minor)) as avg_ticket
                   from cur group by day) x on x.day = d.day),
    'weeklyBySource', (select coalesce(jsonb_agg(jsonb_build_object(
        'week', w.week, 'source', w.source, 'visits', w.visits) order by w.week, w.source), '[]'::jsonb)
      from (select date_trunc('week', day)::date as week, source, count(*)::int as visits
              from cur group by 1, 2) w),
    'newVsReturning', (select jsonb_build_object(
        'new', count(*) filter (where f.first_at >= v_start),
        'returning', count(*) filter (where f.first_at < v_start))
      from (select distinct customer_id from cur where customer_id is not null) c
      join firsts f on f.customer_id = c.customer_id),
    'byWeekday', (select coalesce(jsonb_agg(jsonb_build_object('weekday', d.wd, 'visits', coalesce(x.n, 0))
        order by d.wd), '[]'::jsonb)
      from generate_series(1, 7) as d(wd)
      left join (select extract(isodow from day)::int as wd, count(*)::int as n from cur group by 1) x
        on x.wd = d.wd)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function core.business_stats(uuid, integer) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
