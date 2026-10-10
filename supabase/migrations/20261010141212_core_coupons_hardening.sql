-- =============================================================================
-- CORE · Cupones de campaña: endurecimiento (D-026, no destructivo).
--
--   * Un cupón solo se usa atado a una visita real: del mismo negocio y cliente,
--     no anulada y dentro de la ventana de la campaña (después del envío y hasta
--     N días). Los resultados cuentan solo cupones con esa visita vigente.
--   * El mostrador usa UNA función, core.record_visit_with_coupon: en la misma
--     transacción registra la visita (o reusa la que se cargó hace un momento) y
--     marca el cupón. Ya no hay dos llamadas ni cupones sin visita.
--   * Los cupones respetan el módulo de la campaña (module_disabled).
--   * Nadie del equipo puede usar un cupón de un cliente atado a su propia cuenta
--     (self_redemption).
--   * Códigos con bytes aleatorios criptográficos (pgcrypto).
--
-- Cupones ya marcados sin visita (si los hubiera) dejan de contar en resultados;
-- no se borran ni se modifican.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- De acá en adelante, cupón usado = cupón con visita. `not valid`: no revisa
-- filas viejas (no se tocan), pero sí toda escritura nueva.
alter table core.campaign_recipients
  add constraint campaign_recipients_coupon_visit_required
  check (coupon_redeemed_at is null or coupon_visit_id is not null) not valid;

-- -----------------------------------------------------------------------------
-- Código nuevo con bytes aleatorios criptográficos. 256 es múltiplo de 32: cada
-- byte módulo 32 elige una letra del alfabeto sin sesgo. Interno (sin grant).
-- -----------------------------------------------------------------------------
create or replace function core.new_coupon_code(p_business_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code  text;
begin
  for attempt in 1..20 loop
    v_bytes := extensions.gen_random_bytes(6);
    select string_agg(substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1), '' order by i)
      into v_code from generate_series(0, 5) i;
    if not exists (select 1 from core.campaign_recipients
                    where business_id = p_business_id and coupon_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

-- -----------------------------------------------------------------------------
-- Buscar: igual que antes + el módulo de la campaña tiene que estar habilitado.
-- -----------------------------------------------------------------------------
create or replace function core.find_campaign_coupon(p_business_id uuid, p_code text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_module_id    text;
begin
  perform core.require_member(p_business_id);
  select r.id, k.module_id into v_recipient_id, v_module_id
    from core.campaign_recipients r
    join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
   where r.business_id = p_business_id
     and r.coupon_code = core.normalize_coupon_code(p_code)
     and k.status = 'sent';
  if not found then
    return null;
  end if;
  if not core.has_module(p_business_id, v_module_id) then
    perform core.raise_forbidden('module_disabled');
  end if;
  return core.coupon_info(v_recipient_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Interno: busca y bloquea el cupón y verifica que se pueda usar ahora
-- (existe, módulo habilitado, no es del propio usuario, vigente, sin usar).
-- -----------------------------------------------------------------------------
create function core.lock_coupon_for_use(p_business_id uuid, p_code text)
returns core.campaign_recipients
language plpgsql
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
  v_module_id text;
  v_status    text;
begin
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

  select module_id into v_module_id from core.campaigns
   where business_id = p_business_id and id = v_recipient.campaign_id;
  if not core.has_module(p_business_id, v_module_id) then
    perform core.raise_forbidden('module_disabled');
  end if;

  -- Un cajero no se valida su propio cupón (cliente atado a su cuenta).
  if exists (select 1 from core.customer_accounts a
              where a.business_id = p_business_id and a.customer_id = v_recipient.customer_id
                and a.user_id = (select auth.uid())) then
    perform core.raise_forbidden('self_redemption');
  end if;

  v_status := core.coupon_info(v_recipient.id) ->> 'status';
  if v_status = 'used' then
    raise exception 'coupon_already_used' using errcode = '22023';
  elsif v_status = 'expired' then
    raise exception 'coupon_expired' using errcode = '22023';
  elsif v_status = 'customer_inactive' then
    raise exception 'customer_inactive' using errcode = '22023';
  end if;
  return v_recipient;
end;
$$;

-- -----------------------------------------------------------------------------
-- Interno: verifica la visita y marca el cupón como usado, atado a ella.
-- La visita tiene que existir en el negocio, ser del cliente del cupón, no estar
-- anulada y caer en (envío, envío + N días].
-- -----------------------------------------------------------------------------
create function core.mark_coupon_used(p_recipient core.campaign_recipients, p_visit_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_campaign core.campaigns;
  v_visit    core.visits;
begin
  select * into v_campaign from core.campaigns
   where business_id = p_recipient.business_id and id = p_recipient.campaign_id;
  select * into v_visit from core.visits
   where business_id = p_recipient.business_id and id = p_visit_id;
  if not found
     or v_visit.voided_at is not null
     or v_visit.customer_id is distinct from p_recipient.customer_id
     or v_visit.occurred_at <= v_campaign.sent_at
     or v_visit.occurred_at > v_campaign.sent_at + make_interval(days => v_campaign.attribution_days) then
    raise exception 'coupon_visit_mismatch' using errcode = '22023';
  end if;

  update core.campaign_recipients
     set coupon_redeemed_at = now(), coupon_visit_id = v_visit.id,
         coupon_redeemed_by = (select auth.uid())
   where id = p_recipient.id;

  perform core.emit_event(p_recipient.business_id, 'campaign.coupon_redeemed', jsonb_build_object(
    'campaign_id', p_recipient.campaign_id, 'recipient_id', p_recipient.id,
    'customer_id', p_recipient.customer_id, 'visit_id', v_visit.id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Mostrador: registrar la visita y usar el cupón en una sola transacción.
-- Si el cliente ya tiene una visita vigente de hace un momento (ventana anti
-- doble carga), se reusa esa (el monto no se cambia); si no, se registra una
-- nueva como lo haría core.record_visit desde el mostrador.
-- -----------------------------------------------------------------------------
create function core.record_visit_with_coupon(
  p_business_id  uuid,
  p_code         text,
  p_location_id  uuid default null,
  p_amount_minor bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
  v_campaign  core.campaigns;
  v_dedupe    integer;
  v_visit_id  uuid;
  v_reused    boolean := false;
begin
  perform core.require_member(p_business_id);
  v_recipient := core.lock_coupon_for_use(p_business_id, p_code);
  select * into v_campaign from core.campaigns
   where business_id = p_business_id and id = v_recipient.campaign_id;

  -- Mismo orden de bloqueo que record_visit_internal: el cliente serializa visitas.
  perform 1 from core.customers
   where business_id = p_business_id and id = v_recipient.customer_id
   for update;

  select (core.status_settings(b.settings) ->> 'visit_dedupe_seconds')::int into v_dedupe
    from core.businesses b where b.id = p_business_id;

  select v.id into v_visit_id
    from core.visits v
   where v.business_id = p_business_id
     and v.customer_id = v_recipient.customer_id
     and v.voided_at is null
     and v.occurred_at > v_campaign.sent_at
     and abs(extract(epoch from (v.occurred_at - now()))) < v_dedupe
   order by v.occurred_at desc
   limit 1;

  if v_visit_id is not null then
    v_reused := true;
  else
    v_visit_id := (core.record_visit_internal(p_business_id, p_location_id, v_recipient.customer_id,
                                              p_amount_minor, null, 'manual', null, null,
                                              (select auth.uid()))).id;
  end if;

  perform core.mark_coupon_used(v_recipient, v_visit_id);

  return core.coupon_info(v_recipient.id)
         || jsonb_build_object('visitId', v_visit_id, 'visitReused', v_reused);
end;
$$;

-- -----------------------------------------------------------------------------
-- La función vieja de dos pasos queda solo como interna: la visita es
-- obligatoria y nadie del equipo la puede llamar (el mostrador usa la de arriba).
-- -----------------------------------------------------------------------------
drop function core.redeem_campaign_coupon(uuid, text, uuid);

create function core.redeem_campaign_coupon(p_business_id uuid, p_code text, p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient core.campaign_recipients;
begin
  perform core.require_member(p_business_id);
  v_recipient := core.lock_coupon_for_use(p_business_id, p_code);
  perform core.mark_coupon_used(v_recipient, p_visit_id);
  return core.coupon_info(v_recipient.id);
end;
$$;

revoke execute on function core.redeem_campaign_coupon(uuid, text, uuid) from authenticated;

-- -----------------------------------------------------------------------------
-- Resultados: un cupón cuenta solo si su visita existe y no está anulada.
-- Mismas columnas y mismo cálculo que antes (create or replace).
-- -----------------------------------------------------------------------------
create or replace function core.campaign_results(p_campaign_id uuid)
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
            and r.coupon_visit_id is not null
            and exists (
                  select 1 from core.visits cv
                   where cv.business_id = r.business_id and cv.id = r.coupon_visit_id
                     and cv.voided_at is null)) as coupon_used
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

grant execute on function core.record_visit_with_coupon(uuid, text, uuid, bigint) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
