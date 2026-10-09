-- =============================================================================
-- CORE · Campañas: atribución por cupón (D-026, no destructivo).
--
-- Al lanzar, cada cliente del grupo contactado recibe un cupón de 6 caracteres
-- (único en el negocio) que el mensaje puede incluir con {cupon}. Cuando vuelve y
-- lo muestra, el cajero lo valida en el mostrador: queda marcado como usado y
-- atado a la visita. Es una prueba más fuerte que "volvió dentro de la ventana",
-- pero no la reemplaza: los resultados siguen comparando con el grupo de control.
--
--   * El grupo de control no tiene cupón (no recibe mensaje).
--   * Un cupón se usa una sola vez, dentro de la ventana de la campaña y solo si
--     el cliente sigue activo. La visita tiene que ser del mismo cliente.
--   * Cualquier miembro del equipo (también empleados) puede validar y usar cupones.
-- =============================================================================

alter table core.campaign_recipients
  add column coupon_code        text check (coupon_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  add column coupon_redeemed_at timestamptz,
  add column coupon_visit_id    uuid,
  add column coupon_redeemed_by uuid references auth.users (id) on delete set null,
  add foreign key (business_id, coupon_visit_id) references core.visits (business_id, id) on delete restrict,
  add check (not is_control or coupon_code is null),
  add check (coupon_redeemed_at is not null or (coupon_visit_id is null and coupon_redeemed_by is null)),
  add check (coupon_redeemed_at is null or coupon_code is not null);

create unique index campaign_recipients_coupon_idx
  on core.campaign_recipients (business_id, coupon_code) where coupon_code is not null;
create index campaign_recipients_coupon_visit_idx
  on core.campaign_recipients (business_id, coupon_visit_id) where coupon_visit_id is not null;
create index campaign_recipients_coupon_redeemed_by_idx
  on core.campaign_recipients (coupon_redeemed_by) where coupon_redeemed_by is not null;

-- Código nuevo, único en el negocio. Interno (sin grant).
create function core.new_coupon_code(p_business_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  for i in 1..20 loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    if not exists (select 1 from core.campaign_recipients
                    where business_id = p_business_id and coupon_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

-- Lo que escribe el cajero: sin espacios ni guiones, en mayúsculas. Interno.
create function core.normalize_coupon_code(p_code text) returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- Lanzar: igual que antes + cupón para el grupo contactado y {cupon} en el mensaje.
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
  -- nadie queda en dos campañas a la vez (y los cupones no se pisan).
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
                                        status_at_send, risk_score_at_send, coupon_code, message)
  select v_campaign.business_id, v_campaign.id, p.customer_id, p.is_control,
         p.status, p.risk_score, p.coupon_code,
         case when p.is_control then null else
           replace(replace(replace(replace(v_campaign.message,
             '{nombre}', p.first_name),
             '{negocio}', v_business.name),
             '{beneficio}', coalesce(v_campaign.benefit, '')),
             '{cupon}', p.coupon_code) end
    from (select r.*,
                 case when r.is_control then null
                      else core.new_coupon_code(v_campaign.business_id) end as coupon_code
            from (select m.*, row_number() over (order by random()) <= v_control as is_control
                    from core.segment_members(v_campaign.business_id, v_campaign.segment) m
                   where m.reachable and not m.busy) r) p;
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
-- Estado de un cupón (interno). status: valid | used | expired | customer_inactive
-- -----------------------------------------------------------------------------
create function core.coupon_info(p_recipient core.campaign_recipients) returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'recipientId', p_recipient.id,
    'code', p_recipient.coupon_code,
    'customerId', c.id,
    'customerName', c.name,
    'campaignName', k.name,
    'benefit', k.benefit,
    'expiresAt', k.sent_at + make_interval(days => k.attribution_days),
    'redeemedAt', p_recipient.coupon_redeemed_at,
    'status', case
      when p_recipient.coupon_redeemed_at is not null then 'used'
      when now() > k.sent_at + make_interval(days => k.attribution_days) then 'expired'
      when c.status <> 'active' or c.anonymized_at is not null then 'customer_inactive'
      else 'valid' end)
    from core.campaigns k
    join core.customers c on c.business_id = p_recipient.business_id and c.id = p_recipient.customer_id
   where k.business_id = p_recipient.business_id and k.id = p_recipient.campaign_id
$$;

-- Buscar un cupón para mostrárselo al cajero antes de usarlo. Null si no existe.
create function core.find_campaign_coupon(p_business_id uuid, p_code text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
begin
  perform core.require_member(p_business_id);
  select r.* into v_recipient
    from core.campaign_recipients r
    join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
   where r.business_id = p_business_id
     and r.coupon_code = core.normalize_coupon_code(p_code)
     and k.status = 'sent';
  if not found then
    return null;
  end if;
  return core.coupon_info(v_recipient);
end;
$$;

-- Usar un cupón (una sola vez). p_visit_id: la visita en la que lo trajo
-- (opcional, pero tiene que ser del mismo cliente y estar dentro de la ventana).
create function core.redeem_campaign_coupon(p_business_id uuid, p_code text, p_visit_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
  v_info      jsonb;
  v_campaign  core.campaigns;
  v_visit     core.visits;
begin
  perform core.require_member(p_business_id);
  select r.* into v_recipient
    from core.campaign_recipients r
    join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
   where r.business_id = p_business_id
     and r.coupon_code = core.normalize_coupon_code(p_code)
     and k.status = 'sent'
   for update of r;
  if not found then
    raise exception 'coupon_not_found' using errcode = 'P0002';
  end if;

  v_info := core.coupon_info(v_recipient);
  if v_info ->> 'status' = 'used' then
    raise exception 'coupon_already_used' using errcode = '22023';
  elsif v_info ->> 'status' = 'expired' then
    raise exception 'coupon_expired' using errcode = '22023';
  elsif v_info ->> 'status' = 'customer_inactive' then
    raise exception 'customer_inactive' using errcode = '22023';
  end if;

  if p_visit_id is not null then
    select * into v_campaign from core.campaigns
     where business_id = p_business_id and id = v_recipient.campaign_id;
    select * into v_visit from core.visits where business_id = p_business_id and id = p_visit_id;
    if not found
       or v_visit.voided_at is not null
       or v_visit.customer_id is distinct from v_recipient.customer_id
       or v_visit.occurred_at <= v_campaign.sent_at then
      raise exception 'coupon_visit_mismatch' using errcode = '22023';
    end if;
  end if;

  update core.campaign_recipients
     set coupon_redeemed_at = now(), coupon_visit_id = p_visit_id, coupon_redeemed_by = auth.uid()
   where id = v_recipient.id
  returning * into v_recipient;

  perform core.emit_event(p_business_id, 'campaign.coupon_redeemed', jsonb_build_object(
    'campaign_id', v_recipient.campaign_id, 'recipient_id', v_recipient.id,
    'customer_id', v_recipient.customer_id, 'visit_id', p_visit_id));
  return core.coupon_info(v_recipient);
end;
$$;

-- -----------------------------------------------------------------------------
-- Destinatarios: + cupón (oculto si el cliente está bloqueado) y cuándo se usó.
-- Cambia el tipo de retorno: drop + create y nuevo grant.
-- -----------------------------------------------------------------------------
drop function core.list_campaign_recipients(uuid);

create function core.list_campaign_recipients(p_campaign_id uuid)
returns table (
  recipient_id uuid, customer_id uuid, name text, phone text, is_control boolean,
  status_at_send text, message text, contacted_at timestamptz,
  returned_at timestamptz, returned_amount_minor bigint, blocked_reason text,
  coupon_code text, coupon_redeemed_at timestamptz
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
           r.contacted_at, w.first_at, coalesce(w.amount, 0)::bigint, b.reason,
           case when b.reason is null then r.coupon_code end,
           r.coupon_redeemed_at
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
-- Resultados: + cupones usados (si la visita del cupón se anuló, deja de contar).
-- Cambia el tipo de retorno: drop + create y nuevo grant.
-- -----------------------------------------------------------------------------
drop function core.campaign_results(uuid);

create function core.campaign_results(p_campaign_id uuid)
returns table (
  treatment_count integer, control_count integer, contacted_count integer,
  treatment_returned integer, control_returned integer,
  treatment_revenue_minor bigint, control_revenue_minor bigint,
  treatment_rate numeric, control_rate numeric,
  incremental_customers numeric, incremental_revenue_minor bigint,
  window_ends_at timestamptz, window_open boolean,
  coupons_redeemed integer
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
           (w.n > 0) as returned, coalesce(w.amount, 0) as amount,
           (r.coupon_redeemed_at is not null
            and (r.coupon_visit_id is null or exists (
                  select 1 from core.visits cv
                   where cv.business_id = r.business_id and cv.id = r.coupon_visit_id
                     and cv.voided_at is null))) as coupon_used
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
           coalesce(sum(amount) filter (where is_control), 0)::bigint as c_rev,
           count(*) filter (where coupon_used)::int as coupons
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
         now() < v_campaign.sent_at + make_interval(days => v_campaign.attribution_days),
         a.coupons
    from agg a;
end;
$$;

grant execute on function
  core.list_campaign_recipients(uuid),
  core.campaign_results(uuid),
  core.find_campaign_coupon(uuid, text),
  core.redeem_campaign_coupon(uuid, text, uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
