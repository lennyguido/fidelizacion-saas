-- =============================================================================
-- CORE · Campañas: ajustes después de la revisión (no destructivo).
--
-- Cómo se calculan "volvió", grupo de control y lo incremental: docs/RESULTADOS.md.
--
-- 1. Consentimiento (Ley 25.326): si un cliente se da de baja DESPUÉS de lanzar
--    la campaña, ya no se muestra su teléfono ni su mensaje y no se puede marcar
--    como contactado (error consent_revoked). Lo mismo si se archivó/anonimizó.
-- 2. Campañas superpuestas: al lanzar se excluye a quien ya está (como contactado
--    o como control) en otra campaña enviada cuya ventana sigue abierta. Si no,
--    los grupos de control de las dos campañas se contaminan entre sí.
-- 3. Tablero: "nuevos" = clientes cuya primera visita cae en este mes (no los
--    importados ni los archivados). Corte del mes anterior en hora local (DST).
-- 4. Consentimientos: columna seq para desempatar registros con el mismo now()
--    (misma transacción). Vale el último por (recorded_at, seq).
-- 5. Segmentos: los números tienen que ser enteros y acotados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Consentimientos: desempate por orden de inserción.
-- -----------------------------------------------------------------------------
alter table core.customer_consents
  add column seq bigint generated always as identity;

create index customer_consents_latest_idx
  on core.customer_consents (business_id, customer_id, channel, purpose, recorded_at desc, seq desc);
drop index core.customer_consents_lookup_idx;

create or replace view core.customer_consent_status
with (security_invoker = true) as
select distinct on (business_id, customer_id, channel, purpose)
  business_id, customer_id, channel, purpose, granted, recorded_at
from core.customer_consents
order by business_id, customer_id, channel, purpose, recorded_at desc, seq desc;

grant select on core.customer_consent_status to authenticated;

-- Último consentimiento de WhatsApp para marketing (interno: no se le da grant a nadie).
create function core.whatsapp_marketing_granted(p_business_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select cs.granted from core.customer_consents cs
     where cs.business_id = p_business_id and cs.customer_id = p_customer_id
       and cs.channel = 'whatsapp' and cs.purpose = 'marketing'
     order by cs.recorded_at desc, cs.seq desc
     limit 1), false)
$$;

-- ¿El cliente ya está (contactado o control) en otra campaña enviada con la
-- ventana de atribución abierta? Interno.
create function core.in_open_campaign(p_business_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from core.campaign_recipients r
      join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
     where r.business_id = p_business_id and r.customer_id = p_customer_id
       and k.status = 'sent'
       and now() < k.sent_at + make_interval(days => k.attribution_days))
$$;

-- -----------------------------------------------------------------------------
-- Segmentos
-- -----------------------------------------------------------------------------
create or replace function core.validate_segment(p_segment jsonb) returns void
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
  -- Enteros, no negativos y acotados (evita desbordes al convertir a int).
  -- min_spend_minor está en centavos: tope más alto (10.000 millones en unidades mayores).
  if exists (select 1 from jsonb_each(p_segment) e
              where e.key <> 'statuses'
                and (jsonb_typeof(e.value) <> 'number'
                     or (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric)
                     or (e.value #>> '{}')::numeric < 0
                     or (e.value #>> '{}')::numeric >
                          case when e.key = 'min_spend_minor' then 1000000000000 else 100000 end)) then
    raise exception 'invalid segment numbers' using errcode = '22023';
  end if;
end;
$$;

-- Cambia el tipo de retorno (columna busy): hay que borrarla y crearla de nuevo.
-- Es una función interna (sin grant); no hay datos involucrados.
drop function core.segment_members(uuid, jsonb);

-- Clientes que entran en el segmento (activos, no anonimizados).
-- reachable = además tienen teléfono y consentimiento de WhatsApp vigente.
-- busy      = ya están en otra campaña enviada con la ventana abierta.
create function core.segment_members(p_business_id uuid, p_segment jsonb)
returns table (customer_id uuid, first_name text, status text, risk_score smallint,
               reachable boolean, busy boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         split_part(btrim(c.name), ' ', 1),
         s.status,
         s.risk_score,
         (c.phone is not null and core.whatsapp_marketing_granted(c.business_id, c.id)),
         core.in_open_campaign(c.business_id, c.id)
    from core.customers c
    join core.customer_stats s on s.customer_id = c.id
   where c.business_id = p_business_id
     and c.status = 'active'
     and c.anonymized_at is null
     and (not p_segment ? 'statuses'
          or s.status in (select jsonb_array_elements_text(p_segment -> 'statuses')))
     and s.visit_count >= coalesce((p_segment ->> 'min_visits')::numeric::int, 0)
     and s.total_spend_minor >= coalesce((p_segment ->> 'min_spend_minor')::numeric::bigint, 0)
     and (not p_segment ? 'min_days_since_visit'
          or s.last_visit_at <= now() - make_interval(
               days => (p_segment ->> 'min_days_since_visit')::numeric::int))
$$;

-- Cambia el tipo de retorno (columna busy): drop + create y se vuelve a dar el grant.
drop function core.preview_segment(uuid, jsonb);

-- matching  = entran en el segmento
-- reachable = recibirían el mensaje al lanzar (teléfono + consentimiento + no ocupados)
-- busy      = podrían recibirlo pero están en otra campaña activa: no se incluyen
create function core.preview_segment(p_business_id uuid, p_segment jsonb)
returns table (matching integer, reachable integer, busy integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform core.validate_segment(p_segment);
  return query
    select count(*)::int,
           count(*) filter (where m.reachable and not m.busy)::int,
           count(*) filter (where m.reachable and m.busy)::int
      from core.segment_members(p_business_id, p_segment) m;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lanzar: excluye a los clientes ocupados en otra campaña activa.
-- -----------------------------------------------------------------------------
create or replace function core.launch_campaign(p_campaign_id uuid) returns core.campaigns
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

  -- Dos lanzamientos simultáneos del mismo negocio se esperan uno al otro, así
  -- nadie queda en dos campañas a la vez.
  perform pg_advisory_xact_lock(hashtextextended('core.launch_campaign:' || v_campaign.business_id::text, 0));

  select count(*) into v_total
    from core.segment_members(v_campaign.business_id, v_campaign.segment) m
   where m.reachable and not m.busy;
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
           where m.reachable and not m.busy) p;
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

-- -----------------------------------------------------------------------------
-- Contactar: se vuelve a mirar el consentimiento en el momento de escribir.
-- -----------------------------------------------------------------------------
create or replace function core.mark_recipient_contacted(p_recipient_id uuid)
returns core.campaign_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
  v_customer  core.customers;
begin
  select * into v_recipient from core.campaign_recipients where id = p_recipient_id for update;
  if not found then
    raise exception 'recipient not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_recipient.business_id, array['owner', 'admin']);
  if v_recipient.is_control then
    raise exception 'control_group' using errcode = '22023';
  end if;
  select * into v_customer from core.customers
   where business_id = v_recipient.business_id and id = v_recipient.customer_id;
  if v_customer.status <> 'active' or v_customer.anonymized_at is not null
     or not core.whatsapp_marketing_granted(v_recipient.business_id, v_recipient.customer_id) then
    raise exception 'consent_revoked' using errcode = '22023';
  end if;
  update core.campaign_recipients set contacted_at = coalesce(contacted_at, now())
   where id = p_recipient_id
  returning * into v_recipient;
  return v_recipient;
end;
$$;

-- Cambia el tipo de retorno (columna blocked_reason): drop + create y nuevo grant.
drop function core.list_campaign_recipients(uuid);

-- blocked_reason: 'customer_inactive' (archivado/anonimizado) o 'consent_revoked'
-- (el último consentimiento de WhatsApp ya no está otorgado). Si está bloqueado,
-- teléfono y mensaje vuelven en null: no hay forma de escribirle desde el panel.
create function core.list_campaign_recipients(p_campaign_id uuid)
returns table (
  recipient_id uuid, customer_id uuid, name text, phone text, is_control boolean,
  status_at_send text, message text, contacted_at timestamptz,
  returned_at timestamptz, returned_amount_minor bigint, blocked_reason text
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
    select r.id, r.customer_id, c.name,
           case when b.reason is null then c.phone end,
           r.is_control, r.status_at_send,
           case when b.reason is null then r.message end,
           r.contacted_at, w.first_at, coalesce(w.amount, 0)::bigint, b.reason
      from core.campaign_recipients r
      join core.customers c on c.business_id = r.business_id and c.id = r.customer_id
      cross join lateral (
        select case
                 when c.status <> 'active' or c.anonymized_at is not null then 'customer_inactive'
                 when not core.whatsapp_marketing_granted(r.business_id, r.customer_id) then 'consent_revoked'
               end as reason
      ) b
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

-- -----------------------------------------------------------------------------
-- Tablero: nuevos = primera visita este mes; corte del mes anterior en hora local.
-- -----------------------------------------------------------------------------
create or replace function core.dashboard_summary(p_business_id uuid) returns jsonb
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
  -- Mismo día y hora "de reloj" del mes anterior (si hubo cambio de horario en
  -- el medio, sumar horas reales correría el corte una hora).
  v_prev_same   := least(
    ((date_trunc('month', v_now_local) - interval '1 month')
      + (v_now_local - date_trunc('month', v_now_local))) at time zone v_tz,
    v_month_start);

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
    'newCustomers', (select count(*) from core.customer_stats s
                       join core.customers c on c.business_id = s.business_id and c.id = s.customer_id
                      where s.business_id = p_business_id and s.first_visit_at >= v_month_start
                        and c.status = 'active' and c.anonymized_at is null),
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
  core.list_campaign_recipients(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
