-- =============================================================================
-- CORE · Campañas, grupo de control, resultados ("plata recuperada") y tablero.
--
-- D-009: las campañas son del núcleo porque las van a usar varios módulos
-- (recuperación hoy; VIP, cumpleaños y reseñas después). Cada campaña dice qué
-- módulo la creó (module_id) y exige que ese módulo esté activo.
--
-- Envío (MVP, TASKS Fase 5): sin API de WhatsApp. El sistema arma el mensaje de
-- cada cliente y el dueño lo manda desde su WhatsApp con un link wa.me. Solo
-- entran clientes con teléfono y con consentimiento de WhatsApp vigente.
--
-- Atribución por ventana (D-021): un cliente "volvió" si tiene una visita válida
-- entre el envío y N días después. Se compara contra el grupo de control (clientes
-- elegidos al azar a los que NO se les escribe) para estimar lo incremental.
-- Se calcula al consultar, desde core.visits: si se anula una visita, el
-- resultado se corrige solo.
-- =============================================================================

create table core.campaigns (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references core.businesses (id) on delete restrict,
  module_id        text not null references core.modules (id),
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  segment          jsonb not null check (jsonb_typeof(segment) = 'object'),
  message          text not null check (char_length(message) between 5 and 1000),
  benefit          text check (char_length(benefit) <= 200),
  channel          text not null default 'whatsapp_manual' check (channel in ('whatsapp_manual')),
  control_pct      integer not null default 10 check (control_pct between 0 and 50),
  attribution_days integer not null default 14 check (attribution_days between 1 and 90),
  status           text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  recipients_count integer not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  sent_at          timestamptz,
  cancelled_at     timestamptz,
  unique (business_id, id),
  check (status <> 'sent' or sent_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null)
);

create index campaigns_business_idx on core.campaigns (business_id, created_at desc);
create index campaigns_module_idx on core.campaigns (module_id);
create index campaigns_created_by_idx on core.campaigns (created_by) where created_by is not null;

create trigger campaigns_updated_at before update on core.campaigns
  for each row execute function core.set_updated_at();
create trigger campaigns_audit after insert or update on core.campaigns
  for each row execute function core.audit_row();

create table core.campaign_recipients (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references core.businesses (id) on delete restrict,
  campaign_id        uuid not null,
  customer_id        uuid not null,
  is_control         boolean not null,
  status_at_send     text not null,
  risk_score_at_send smallint not null default 0,
  message            text,
  contacted_at       timestamptz,
  unique (business_id, id),
  unique (campaign_id, customer_id),
  foreign key (business_id, campaign_id) references core.campaigns (business_id, id) on delete restrict,
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict,
  check (not is_control or (message is null and contacted_at is null))
);

create index campaign_recipients_business_idx on core.campaign_recipients (business_id, campaign_id);
create index campaign_recipients_customer_idx on core.campaign_recipients (business_id, customer_id);

alter table core.campaigns enable row level security;
alter table core.campaign_recipients enable row level security;

grant select on core.campaigns, core.campaign_recipients to authenticated;

create policy campaigns_select on core.campaigns for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));
create policy campaign_recipients_select on core.campaign_recipients for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- -----------------------------------------------------------------------------
-- Segmentos (versión 1: filtros fijos y validados, sin SQL libre)
--   {"statuses": ["AT_RISK","INACTIVE"], "min_visits": 2, "min_spend_minor": 0,
--    "min_days_since_visit": 30}
-- -----------------------------------------------------------------------------
create function core.validate_segment(p_segment jsonb) returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
begin
  if p_segment is null or jsonb_typeof(p_segment) <> 'object' then
    raise exception 'invalid segment' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_segment) loop
    if v_key not in ('statuses', 'min_visits', 'min_spend_minor', 'min_days_since_visit') then
      raise exception 'invalid segment key: %', v_key using errcode = '22023';
    end if;
  end loop;
  if p_segment ? 'statuses' and (
       jsonb_typeof(p_segment -> 'statuses') <> 'array'
       or exists (select 1 from jsonb_array_elements_text(p_segment -> 'statuses') s
                   where s not in ('NEW', 'ACTIVE', 'AT_RISK', 'INACTIVE', 'RECOVERED'))) then
    raise exception 'invalid segment statuses' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_segment) e
              where e.key <> 'statuses'
                and (jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric < 0)) then
    raise exception 'invalid segment numbers' using errcode = '22023';
  end if;
end;
$$;

-- Clientes que entran en el segmento (activos, no anonimizados).
-- reachable = además tienen teléfono y consentimiento de WhatsApp vigente.
create function core.segment_members(p_business_id uuid, p_segment jsonb)
returns table (customer_id uuid, first_name text, status text, risk_score smallint, reachable boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         split_part(btrim(c.name), ' ', 1),
         s.status,
         s.risk_score,
         (c.phone is not null and coalesce((
            select cs.granted from core.customer_consents cs
             where cs.business_id = c.business_id and cs.customer_id = c.id
               and cs.channel = 'whatsapp' and cs.purpose = 'marketing'
             order by cs.recorded_at desc limit 1), false))
    from core.customers c
    join core.customer_stats s on s.customer_id = c.id
   where c.business_id = p_business_id
     and c.status = 'active'
     and c.anonymized_at is null
     and (not p_segment ? 'statuses'
          or s.status in (select jsonb_array_elements_text(p_segment -> 'statuses')))
     and s.visit_count >= coalesce((p_segment ->> 'min_visits')::int, 0)
     and s.total_spend_minor >= coalesce((p_segment ->> 'min_spend_minor')::bigint, 0)
     and (not p_segment ? 'min_days_since_visit'
          or s.last_visit_at <= now() - make_interval(days => (p_segment ->> 'min_days_since_visit')::int))
$$;

create function core.preview_segment(p_business_id uuid, p_segment jsonb)
returns table (matching integer, reachable integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform core.validate_segment(p_segment);
  return query
    select count(*)::int, count(*) filter (where m.reachable)::int
      from core.segment_members(p_business_id, p_segment) m;
end;
$$;

-- -----------------------------------------------------------------------------
-- Crear, lanzar y cancelar
-- -----------------------------------------------------------------------------
create function core.create_campaign(
  p_business_id      uuid,
  p_module_id        text,
  p_name             text,
  p_segment          jsonb,
  p_message          text,
  p_benefit          text default null,
  p_control_pct      integer default 10,
  p_attribution_days integer default 14
) returns core.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, p_module_id) then
    perform core.raise_forbidden('module_disabled');
  end if;
  perform core.validate_segment(p_segment);

  insert into core.campaigns (business_id, module_id, name, segment, message, benefit,
                              control_pct, attribution_days, created_by)
  values (p_business_id, p_module_id, btrim(p_name), p_segment, btrim(p_message),
          nullif(btrim(p_benefit), ''), coalesce(p_control_pct, 10), coalesce(p_attribution_days, 14),
          (select auth.uid()))
  returning * into v_campaign;
  return v_campaign;
end;
$$;

-- Congela la lista: elige al azar el grupo de control y arma el mensaje de cada uno.
create function core.launch_campaign(p_campaign_id uuid) returns core.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
  v_business core.businesses;
  v_total    integer;
  v_control  integer;
begin
  select * into v_campaign from core.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_campaign.business_id, array['owner', 'admin']);
  if v_campaign.status <> 'draft' then
    raise exception 'campaign_not_draft' using errcode = '22023';
  end if;
  if not core.has_module(v_campaign.business_id, v_campaign.module_id) then
    perform core.raise_forbidden('module_disabled');
  end if;
  select * into v_business from core.businesses where id = v_campaign.business_id;

  select count(*) into v_total
    from core.segment_members(v_campaign.business_id, v_campaign.segment) m
   where m.reachable;
  if v_total = 0 then
    raise exception 'empty_segment' using errcode = '22023';
  end if;
  v_control := floor(v_total * v_campaign.control_pct / 100.0)::int;

  -- Orden al azar: los primeros v_control quedan como grupo de control.
  insert into core.campaign_recipients (business_id, campaign_id, customer_id, is_control,
                                        status_at_send, risk_score_at_send, message)
  select v_campaign.business_id, v_campaign.id, p.customer_id, p.rn <= v_control,
         p.status, p.risk_score,
         case when p.rn <= v_control then null else
           replace(replace(replace(v_campaign.message,
             '{nombre}', p.first_name),
             '{negocio}', v_business.name),
             '{beneficio}', coalesce(v_campaign.benefit, '')) end
    from (select m.*, row_number() over (order by random()) as rn
            from core.segment_members(v_campaign.business_id, v_campaign.segment) m
           where m.reachable) p;
  get diagnostics v_total = row_count;

  update core.campaigns
     set status = 'sent', sent_at = now(), recipients_count = v_total
   where id = p_campaign_id
  returning * into v_campaign;

  perform core.emit_event(v_campaign.business_id, 'campaign.sent', jsonb_build_object(
    'campaign_id', v_campaign.id, 'module_id', v_campaign.module_id,
    'recipients', v_total, 'control', v_control));
  return v_campaign;
end;
$$;

create function core.cancel_campaign(p_campaign_id uuid) returns core.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
begin
  select * into v_campaign from core.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_campaign.business_id, array['owner', 'admin']);
  if v_campaign.status <> 'draft' then
    raise exception 'campaign_not_draft' using errcode = '22023';
  end if;
  update core.campaigns set status = 'cancelled', cancelled_at = now() where id = p_campaign_id
  returning * into v_campaign;
  return v_campaign;
end;
$$;

-- El dueño abrió WhatsApp para ese cliente (queda registrado quién y cuándo).
create function core.mark_recipient_contacted(p_recipient_id uuid) returns core.campaign_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
begin
  select * into v_recipient from core.campaign_recipients where id = p_recipient_id for update;
  if not found then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_recipient.business_id, array['owner', 'admin']);
  if v_recipient.is_control then
    raise exception 'control_group' using errcode = '22023';
  end if;
  update core.campaign_recipients set contacted_at = coalesce(contacted_at, now())
   where id = p_recipient_id
  returning * into v_recipient;
  return v_recipient;
end;
$$;

-- -----------------------------------------------------------------------------
-- Destinatarios y resultados
-- -----------------------------------------------------------------------------
create function core.list_campaign_recipients(p_campaign_id uuid)
returns table (
  recipient_id uuid, customer_id uuid, name text, phone text, is_control boolean,
  status_at_send text, message text, contacted_at timestamptz,
  returned_at timestamptz, returned_amount_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
begin
  select * into v_campaign from core.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_campaign.business_id, array['owner', 'admin']);
  return query
    select r.id, r.customer_id, c.name, c.phone, r.is_control, r.status_at_send, r.message,
           r.contacted_at, w.first_at, coalesce(w.amount, 0)::bigint
      from core.campaign_recipients r
      join core.customers c on c.id = r.customer_id
      left join lateral (
        select min(v.occurred_at) as first_at, sum(coalesce(v.amount_minor, 0)) as amount
          from core.visits v
         where v.business_id = r.business_id and v.customer_id = r.customer_id
           and v.voided_at is null
           and v.occurred_at > v_campaign.sent_at
           and v.occurred_at <= v_campaign.sent_at + make_interval(days => v_campaign.attribution_days)
      ) w on true
     where r.campaign_id = p_campaign_id
     order by r.is_control, w.first_at is null, c.name;
end;
$$;

-- Resultados con grupo de control. Fórmulas (docs/RESULTADOS.md):
--   tasa = volvieron / destinatarios (por grupo)
--   clientes incrementales = (tasa_contactados - tasa_control) × contactados
--   plata incremental = (gasto_promedio_contactados - gasto_promedio_control) × contactados
-- Sin grupo de control, lo incremental es null (no se puede estimar honestamente).
create function core.campaign_results(p_campaign_id uuid)
returns table (
  treatment_count integer, control_count integer, contacted_count integer,
  treatment_returned integer, control_returned integer,
  treatment_revenue_minor bigint, control_revenue_minor bigint,
  treatment_rate numeric, control_rate numeric,
  incremental_customers numeric, incremental_revenue_minor bigint,
  window_ends_at timestamptz, window_open boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
begin
  select * into v_campaign from core.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_campaign.business_id, array['owner', 'admin']);
  if v_campaign.status <> 'sent' then
    raise exception 'campaign_not_sent' using errcode = '22023';
  end if;

  return query
  with per as (
    select r.is_control, r.contacted_at,
           (w.n > 0) as returned, coalesce(w.amount, 0) as amount
      from core.campaign_recipients r
      left join lateral (
        select count(*) as n, sum(coalesce(v.amount_minor, 0)) as amount
          from core.visits v
         where v.business_id = r.business_id and v.customer_id = r.customer_id
           and v.voided_at is null
           and v.occurred_at > v_campaign.sent_at
           and v.occurred_at <= v_campaign.sent_at + make_interval(days => v_campaign.attribution_days)
      ) w on true
     where r.campaign_id = p_campaign_id
  ), agg as (
    select count(*) filter (where not is_control)::int as t_n,
           count(*) filter (where is_control)::int as c_n,
           count(*) filter (where not is_control and contacted_at is not null)::int as t_contacted,
           count(*) filter (where not is_control and returned)::int as t_ret,
           count(*) filter (where is_control and returned)::int as c_ret,
           coalesce(sum(amount) filter (where not is_control), 0)::bigint as t_rev,
           coalesce(sum(amount) filter (where is_control), 0)::bigint as c_rev
      from per
  )
  select a.t_n, a.c_n, a.t_contacted, a.t_ret, a.c_ret, a.t_rev, a.c_rev,
         case when a.t_n > 0 then round(a.t_ret::numeric / a.t_n, 4) end,
         case when a.c_n > 0 then round(a.c_ret::numeric / a.c_n, 4) end,
         case when a.c_n > 0 and a.t_n > 0
              then round((a.t_ret::numeric / a.t_n - a.c_ret::numeric / a.c_n) * a.t_n, 1) end,
         case when a.c_n > 0 and a.t_n > 0
              then round((a.t_rev::numeric / a.t_n - a.c_rev::numeric / a.c_n) * a.t_n)::bigint end,
         v_campaign.sent_at + make_interval(days => v_campaign.attribution_days),
         now() < v_campaign.sent_at + make_interval(days => v_campaign.attribution_days)
    from agg a;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tablero del negocio (mes en curso vs. mismo período del mes anterior, en la
-- zona horaria del negocio). Dueño/admin.
-- -----------------------------------------------------------------------------
create function core.dashboard_summary(p_business_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz          text;
  v_now_local   timestamp;
  v_month_start timestamptz;
  v_prev_start  timestamptz;
  v_prev_same   timestamptz;
  v_result      jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  select timezone into v_tz from core.businesses where id = p_business_id;
  v_now_local   := now() at time zone v_tz;
  v_month_start := date_trunc('month', v_now_local) at time zone v_tz;
  v_prev_start  := (date_trunc('month', v_now_local) - interval '1 month') at time zone v_tz;
  v_prev_same   := least(v_prev_start + (now() - v_month_start), v_month_start);

  with v as (
    select occurred_at, customer_id, amount_minor
      from core.visits
     where business_id = p_business_id and voided_at is null and occurred_at >= v_prev_start
  ), cur as (
    select count(*)::int as visits,
           count(*) filter (where customer_id is not null)::int as identified,
           coalesce(sum(amount_minor), 0)::bigint as revenue,
           count(amount_minor)::int as with_amount
      from v where occurred_at >= v_month_start
  ), prev as (
    select count(*)::int as visits, coalesce(sum(amount_minor), 0)::bigint as revenue
      from v where occurred_at >= v_prev_start and occurred_at < v_prev_same
  )
  select jsonb_build_object(
    'monthStart', v_month_start,
    'visits', cur.visits,
    'visitsPrev', prev.visits,
    'identifiedVisits', cur.identified,
    'revenueMinor', cur.revenue,
    'revenuePrevMinor', prev.revenue,
    'avgTicketMinor', case when cur.with_amount > 0 then (cur.revenue / cur.with_amount) end,
    'newCustomers', (select count(*) from core.customers c
                      where c.business_id = p_business_id and c.created_at >= v_month_start
                        and c.anonymized_at is null),
    'recoveredCustomers', (select count(distinct h.customer_id) from core.customer_status_history h
                            where h.business_id = p_business_id and h.to_status = 'RECOVERED'
                              and h.changed_at >= v_month_start),
    'statusCounts', (select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb) from (
                       select s.status, count(*) as n
                         from core.customer_stats s join core.customers c on c.id = s.customer_id
                        where s.business_id = p_business_id and c.status = 'active'
                          and c.anonymized_at is null
                        group by s.status) x),
    'atRiskValueMinor', (select coalesce(sum(s.total_spend_minor), 0)
                           from core.customer_stats s join core.customers c on c.id = s.customer_id
                          where s.business_id = p_business_id and c.status = 'active'
                            and s.status in ('AT_RISK', 'INACTIVE')),
    'recentVisits', (select coalesce(jsonb_agg(jsonb_build_object(
                         'occurredAt', rv.occurred_at, 'amountMinor', rv.amount_minor,
                         'customerName', rv.name) order by rv.occurred_at desc), '[]'::jsonb)
                       from (select vv.occurred_at, vv.amount_minor, c.name
                               from core.visits vv left join core.customers c on c.id = vv.customer_id
                              where vv.business_id = p_business_id and vv.voided_at is null
                              order by vv.occurred_at desc limit 8) rv)
  ) into v_result
  from cur, prev;
  return v_result;
end;
$$;

grant execute on function
  core.preview_segment(uuid, jsonb),
  core.create_campaign(uuid, text, text, jsonb, text, text, integer, integer),
  core.launch_campaign(uuid),
  core.cancel_campaign(uuid),
  core.mark_recipient_contacted(uuid),
  core.list_campaign_recipients(uuid),
  core.campaign_results(uuid),
  core.dashboard_summary(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
