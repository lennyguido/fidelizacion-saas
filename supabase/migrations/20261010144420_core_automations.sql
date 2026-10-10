-- =============================================================================
-- CORE · Recuperación automática (D-031, no destructivo).
--
-- Tres automatizaciones por negocio (apagadas por defecto, las configura el
-- dueño o un admin):
--   * at_risk:      clientes con 2+ visitas que tardan más que su intervalo
--                   habitual × 2 (mínimo `days`, por defecto 14). Con pocos datos
--                   (2 visitas o sin intervalo), 30 días fijos.
--   * second_visit: a los `days` días (por defecto 10) de la primera visita, si
--                   no volvió.
--   * birthday:     el día del cumpleaños (o `days` días antes), en la zona
--                   horaria del negocio. Columnas nuevas birth_day/birth_month
--                   (sin año) en core.customers.
--
-- Motor: core.run_automations(), una vez por día con pg_cron. Por cada
-- automatización encendida arma UNA campaña automática del día (campaña normal
-- del núcleo, ya enviada): grupo de control, cupones, mensaje y atribución
-- funcionan igual que en las campañas a mano (D-021, D-023, D-026, D-027).
--   * Idempotente: una campaña por negocio, automatización y día local.
--   * Solo clientes activos, con teléfono, consentimiento de WhatsApp vigente y
--     sin otra campaña con la ventana abierta.
--   * Cooldown de 30 días por automatización; cumpleaños una vez por año.
--     "En riesgo" escribe una sola vez por ausencia: hasta que el cliente vuelve,
--     no se le insiste.
--   * Grupo de control: cada cliente cae en control con probabilidad control_pct
--     (con pocos clientes por día, un porcentaje fijo daría siempre cero).
--
-- Cola de envío: core.outbox. Hoy el proveedor es 'manual' (el dueño manda cada
-- mensaje con un toque de wa.me desde "Mensajes listos"). Los proveedores
-- automáticos (WhatsApp Cloud API, avisos de la wallet) son checkpoint del
-- dueño: docs/RECUPERACION-AUTOMATICA.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cumpleaños (sin año: alcanza para saludar y es un dato menos).
-- -----------------------------------------------------------------------------
alter table core.customers
  add column birth_day   smallint check (birth_day between 1 and 31),
  add column birth_month smallint check (birth_month between 1 and 12),
  add constraint customers_birthday_pair check ((birth_day is null) = (birth_month is null)),
  add constraint customers_birthday_valid check (
    birth_day is null
    or birth_day <= case when birth_month = 2 then 29
                         when birth_month in (4, 6, 9, 11) then 30
                         else 31 end);

create index customers_birthday_idx on core.customers (business_id, birth_month, birth_day)
  where birth_month is not null;

grant insert (birth_day, birth_month), update (birth_day, birth_month)
  on core.customers to authenticated;

-- -----------------------------------------------------------------------------
-- Campañas automáticas: misma tabla, marcadas con la automatización y el día.
-- -----------------------------------------------------------------------------
alter table core.campaigns
  add column automation_kind text check (automation_kind in ('at_risk', 'second_visit', 'birthday')),
  add column automation_date date,
  add constraint campaigns_automation_pair check ((automation_kind is null) = (automation_date is null));

create unique index campaigns_automation_day_idx
  on core.campaigns (business_id, automation_kind, automation_date)
  where automation_kind is not null;

-- -----------------------------------------------------------------------------
-- Configuración por negocio y automatización.
-- -----------------------------------------------------------------------------
create table core.automations (
  business_id      uuid not null references core.businesses (id) on delete restrict,
  kind             text not null check (kind in ('at_risk', 'second_visit', 'birthday')),
  enabled          boolean not null default false,
  days             integer not null check (days between 0 and 180),
  message          text not null check (char_length(message) between 5 and 1000),
  benefit          text check (char_length(benefit) <= 200),
  control_pct      integer not null default 10 check (control_pct between 0 and 50),
  attribution_days integer not null default 14 check (attribution_days between 1 and 90),
  updated_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (business_id, kind)
);

create index automations_updated_by_idx on core.automations (updated_by) where updated_by is not null;

create trigger automations_updated_at before update on core.automations
  for each row execute function core.set_updated_at();
create trigger automations_audit after insert or update on core.automations
  for each row execute function core.audit_row();

alter table core.automations enable row level security;
grant select on core.automations to authenticated;
create policy automations_select on core.automations for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- -----------------------------------------------------------------------------
-- Cola de envío. Un mensaje por destinatario contactado de una campaña automática.
-- status: queued (espera a un proveedor automático), manual (lo manda el dueño
-- a mano), sent, failed (falló o se descartó).
-- No guarda teléfono: se lee del cliente al momento de mandar (y se vuelve a
-- mirar el consentimiento).
-- -----------------------------------------------------------------------------
create table core.outbox (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references core.businesses (id) on delete restrict,
  campaign_id   uuid not null,
  recipient_id  uuid not null,
  customer_id   uuid not null,
  channel       text not null default 'whatsapp' check (channel in ('whatsapp')),
  provider      text not null default 'manual'
                check (provider in ('manual', 'whatsapp_cloud', 'wallet_push')),
  status        text not null default 'manual' check (status in ('queued', 'sent', 'failed', 'manual')),
  message       text not null,
  attempts      integer not null default 0,
  error         text check (char_length(error) <= 500),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  sent_by       uuid references auth.users (id) on delete set null,
  unique (business_id, id),
  unique (recipient_id),
  foreign key (business_id, campaign_id) references core.campaigns (business_id, id) on delete restrict,
  foreign key (business_id, recipient_id) references core.campaign_recipients (business_id, id) on delete restrict,
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict,
  check (status <> 'sent' or sent_at is not null)
);

create index outbox_business_idx on core.outbox (business_id, status, created_at);
create index outbox_campaign_idx on core.outbox (business_id, campaign_id);
create index outbox_customer_idx on core.outbox (business_id, customer_id);
create index outbox_sent_by_idx on core.outbox (sent_by) where sent_by is not null;

alter table core.outbox enable row level security;
grant select on core.outbox to authenticated;
create policy outbox_select on core.outbox for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- -----------------------------------------------------------------------------
-- Valores por defecto de cada automatización (interno).
-- -----------------------------------------------------------------------------
create function core.automation_defaults(p_kind text) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'at_risk' then jsonb_build_object(
      'days', 14, 'benefit', 'un 10% de descuento',
      'message', '¡Hola {nombre}! Hace un tiempo que no te vemos por {negocio}. Te esperamos con {beneficio}: mostrá el código {cupon}.')
    when 'second_visit' then jsonb_build_object(
      'days', 10, 'benefit', 'un 10% de descuento',
      'message', '¡Hola {nombre}! Gracias por venir a {negocio}. En tu próxima visita tenés {beneficio} con el código {cupon}.')
    when 'birthday' then jsonb_build_object(
      'days', 0, 'benefit', 'un regalo',
      'message', '¡Feliz cumpleaños, {nombre}! En {negocio} te esperamos con {beneficio}. Mostrá el código {cupon}.')
  end
$$;

-- Rango válido de `days` por automatización (interno).
create function core.automation_days_valid(p_kind text, p_days integer) returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'at_risk' then p_days between 7 and 180
    when 'second_visit' then p_days between 3 and 60
    when 'birthday' then p_days between 0 and 14
    else false
  end
$$;

-- -----------------------------------------------------------------------------
-- Ver la configuración (las tres, con los valores por defecto si no se guardó).
-- -----------------------------------------------------------------------------
create function core.list_automations(p_business_id uuid)
returns table (
  kind text, enabled boolean, days integer, message text, benefit text,
  control_pct integer, attribution_days integer, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  return query
    select k.kind,
           coalesce(a.enabled, false),
           coalesce(a.days, (core.automation_defaults(k.kind) ->> 'days')::int),
           coalesce(a.message, core.automation_defaults(k.kind) ->> 'message'),
           case when a.kind is null then core.automation_defaults(k.kind) ->> 'benefit' else a.benefit end,
           coalesce(a.control_pct, 10),
           coalesce(a.attribution_days, 14),
           a.updated_at
      from unnest(array['at_risk', 'second_visit', 'birthday']) with ordinality as k(kind, ord)
      left join core.automations a on a.business_id = p_business_id and a.kind = k.kind
     order by k.ord;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guardar la configuración de una automatización. Dueño o admin.
-- -----------------------------------------------------------------------------
create function core.set_automation(
  p_business_id      uuid,
  p_kind             text,
  p_enabled          boolean,
  p_days             integer,
  p_message          text,
  p_benefit          text default null,
  p_control_pct      integer default 10,
  p_attribution_days integer default 14
) returns core.automations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row core.automations;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  if p_kind is null or p_kind not in ('at_risk', 'second_visit', 'birthday') then
    raise exception 'invalid automation' using errcode = '22023';
  end if;
  if p_enabled is null or not core.automation_days_valid(p_kind, p_days) then
    raise exception 'invalid automation days' using errcode = '22023';
  end if;

  insert into core.automations (business_id, kind, enabled, days, message, benefit,
                                control_pct, attribution_days, updated_by)
  values (p_business_id, p_kind, p_enabled, p_days, btrim(p_message), nullif(btrim(p_benefit), ''),
          p_control_pct, p_attribution_days, (select auth.uid()))
  on conflict (business_id, kind) do update
    set enabled = excluded.enabled, days = excluded.days, message = excluded.message,
        benefit = excluded.benefit, control_pct = excluded.control_pct,
        attribution_days = excluded.attribution_days, updated_by = excluded.updated_by
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Candidatos de una automatización en un momento dado (interno).
-- p_now se recibe como parámetro para poder probar fechas (cumpleaños, cooldown).
-- -----------------------------------------------------------------------------
create function core.automation_candidates(p_automation core.automations, p_now timestamptz)
returns table (customer_id uuid, first_name text, status text, risk_score smallint)
language sql
stable
set search_path = ''
as $$
  with params as (
    select (p_now at time zone b.timezone)::date as today,
           ((p_now at time zone b.timezone)::date + p_automation.days) as target_day
      from core.businesses b where b.id = p_automation.business_id
  )
  select c.id, split_part(btrim(c.name), ' ', 1), s.status, s.risk_score
    from core.customers c
    join core.customer_stats s on s.business_id = c.business_id and s.customer_id = c.id
    cross join params
   where c.business_id = p_automation.business_id
     and c.status = 'active'
     and c.anonymized_at is null
     and c.phone is not null
     and core.whatsapp_marketing_granted(c.business_id, c.id)
     -- Sin otra campaña enviada con la ventana abierta en p_now.
     and not exists (
           select 1
             from core.campaign_recipients r
             join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
            where r.business_id = c.business_id and r.customer_id = c.id
              and k.status = 'sent' and k.sent_at <= p_now
              and p_now < k.sent_at + make_interval(days => k.attribution_days))
     -- Cooldown de la misma automatización: 30 días (cumpleaños, 360).
     and not exists (
           select 1
             from core.campaign_recipients r
             join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
            where r.business_id = c.business_id and r.customer_id = c.id
              and k.automation_kind = p_automation.kind
              and k.sent_at > p_now - make_interval(
                    days => case when p_automation.kind = 'birthday' then 360 else 30 end))
     and case p_automation.kind
       when 'at_risk' then
         s.visit_count >= 2
         and s.last_visit_at is not null
         and p_now - s.last_visit_at > make_interval(days =>
               case when s.visit_count >= 3 and s.median_interval_days is not null
                    then greatest(p_automation.days, ceil(s.median_interval_days * 2)::int)
                    else greatest(p_automation.days, 30) end)
         -- Una vez por ausencia: si ya se le escribió y no volvió, no se insiste.
         and not exists (
               select 1
                 from core.campaign_recipients r
                 join core.campaigns k on k.business_id = r.business_id and k.id = r.campaign_id
                where r.business_id = c.business_id and r.customer_id = c.id
                  and k.automation_kind = 'at_risk'
                  and k.sent_at > s.last_visit_at)
       when 'second_visit' then
         s.visit_count = 1
         and s.first_visit_at is not null
         -- Ventana de 3 días: si el motor no corrió un día, no se pierde nadie;
         -- y al encenderla no se escribe a gente que vino una vez hace meses.
         and s.first_visit_at <= p_now - make_interval(days => p_automation.days)
         and s.first_visit_at > p_now - make_interval(days => p_automation.days + 3)
       when 'birthday' then
         c.birth_month is not null
         and (c.birth_month, c.birth_day) = (
               extract(month from params.target_day)::int, extract(day from params.target_day)::int)
         or (
           -- 29 de febrero: en los años no bisiestos se saluda el 28.
           p_automation.kind = 'birthday'
           and c.birth_month = 2 and c.birth_day = 29
           and extract(month from params.target_day) = 2 and extract(day from params.target_day) = 28
           and extract(day from (date_trunc('month', params.target_day) + interval '1 month - 1 day')) = 28)
       else false
     end
$$;

-- Mensaje con los datos del cliente (interno). Mismas variables que las campañas.
create function core.render_campaign_message(
  p_message text, p_first_name text, p_business_name text, p_benefit text, p_coupon text
) returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(p_message,
    '{nombre}', coalesce(p_first_name, '')),
    '{negocio}', coalesce(p_business_name, '')),
    '{beneficio}', coalesce(p_benefit, '')),
    '{cupon}', coalesce(p_coupon, ''))
$$;

-- -----------------------------------------------------------------------------
-- Correr una automatización de un negocio (interno). Devuelve cuántos clientes
-- entraron (0 si no había nadie o si ya corrió hoy).
-- -----------------------------------------------------------------------------
create function core.run_automation(p_automation core.automations, p_now timestamptz)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_business core.businesses;
  v_today    date;
  v_campaign core.campaigns;
  v_total    integer;
  v_control  integer;
  v_names    constant jsonb := '{"at_risk":"En riesgo","second_visit":"Segunda visita","birthday":"Cumpleaños"}';
begin
  select * into v_business from core.businesses where id = p_automation.business_id;
  v_today := (p_now at time zone v_business.timezone)::date;

  -- Mismo candado que launch_campaign: nadie queda en dos campañas a la vez.
  perform pg_advisory_xact_lock(hashtextextended('core.launch_campaign:' || v_business.id::text, 0));

  if exists (select 1 from core.campaigns
              where business_id = v_business.id and automation_kind = p_automation.kind
                and automation_date = v_today) then
    return 0;
  end if;

  create temp table if not exists pg_temp.automation_batch (
    customer_id uuid, first_name text, status text, risk_score smallint,
    is_control boolean, coupon_code text
  ) on commit drop;
  truncate pg_temp.automation_batch;

  insert into pg_temp.automation_batch (customer_id, first_name, status, risk_score, is_control)
  select c.customer_id, c.first_name, c.status, c.risk_score,
         random() < p_automation.control_pct / 100.0
    from core.automation_candidates(p_automation, p_now) c;
  get diagnostics v_total = row_count;
  if v_total = 0 then
    return 0;
  end if;

  update pg_temp.automation_batch set coupon_code = core.new_coupon_code(v_business.id)
   where not is_control;

  insert into core.campaigns (business_id, module_id, name, segment, message, benefit,
                              control_pct, attribution_days, status, sent_at,
                              automation_kind, automation_date)
  values (v_business.id, 'recovery',
          'Automática · ' || (v_names ->> p_automation.kind) || ' · ' || to_char(v_today, 'DD/MM/YYYY'),
          '{}', p_automation.message, p_automation.benefit,
          p_automation.control_pct, p_automation.attribution_days, 'sent', p_now,
          p_automation.kind, v_today)
  returning * into v_campaign;

  insert into core.campaign_recipients (business_id, campaign_id, customer_id, is_control,
                                        status_at_send, risk_score_at_send, coupon_code, message)
  select v_business.id, v_campaign.id, b.customer_id, b.is_control, b.status, b.risk_score,
         b.coupon_code,
         case when b.is_control then null else
           core.render_campaign_message(p_automation.message, b.first_name, v_business.name,
                                        p_automation.benefit, b.coupon_code) end
    from pg_temp.automation_batch b;

  insert into core.outbox (business_id, campaign_id, recipient_id, customer_id, provider, status, message)
  select r.business_id, r.campaign_id, r.id, r.customer_id, 'manual', 'manual', r.message
    from core.campaign_recipients r
   where r.campaign_id = v_campaign.id and not r.is_control;

  select count(*) filter (where is_control) into v_control from pg_temp.automation_batch;
  update core.campaigns set recipients_count = v_total where id = v_campaign.id;

  perform core.emit_event(v_business.id, 'campaign.sent', jsonb_build_object(
    'campaign_id', v_campaign.id, 'module_id', 'recovery', 'automation', p_automation.kind,
    'recipients', v_total, 'control', v_control));
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Motor diario: todas las automatizaciones encendidas de negocios con el módulo
-- de recuperación. Si un negocio falla, se avisa y se sigue con los demás.
-- -----------------------------------------------------------------------------
create function core.run_automations(p_now timestamptz default now()) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation core.automations;
  v_total      integer := 0;
begin
  for v_automation in
    select a.* from core.automations a
     where a.enabled and core.has_module(a.business_id, 'recovery')
     order by a.business_id, a.kind
  loop
    begin
      v_total := v_total + core.run_automation(v_automation, p_now);
    exception when others then
      raise warning 'core.run_automations: % / %: %', v_automation.business_id, v_automation.kind, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;

-- "Revisar ahora" desde el panel (dueño o admin): corre las automatizaciones
-- encendidas del negocio. Idempotente: si ya corrieron hoy, no hace nada.
create function core.run_business_automations(p_business_id uuid) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation core.automations;
  v_total      integer := 0;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  for v_automation in
    select a.* from core.automations a
     where a.business_id = p_business_id and a.enabled
     order by a.kind
  loop
    v_total := v_total + core.run_automation(v_automation, now());
  end loop;
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bandeja "Mensajes listos" (dueño o admin). Como en list_campaign_recipients,
-- si el cliente ya no acepta mensajes o se archivó, no se devuelven teléfono ni
-- mensaje (blocked_reason).
-- -----------------------------------------------------------------------------
create function core.list_outbox(p_business_id uuid, p_status text default 'manual')
returns table (
  outbox_id uuid, campaign_id uuid, automation_kind text, customer_id uuid, name text,
  phone text, message text, status text, created_at timestamptz, sent_at timestamptz,
  blocked_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'recovery') then
    perform core.raise_forbidden('module_disabled');
  end if;
  return query
    select o.id, o.campaign_id, k.automation_kind, o.customer_id, c.name,
           case when b.reason is null then c.phone end,
           case when b.reason is null then o.message end,
           o.status, o.created_at, o.sent_at, b.reason
      from core.outbox o
      join core.campaigns k on k.business_id = o.business_id and k.id = o.campaign_id
      join core.customers c on c.business_id = o.business_id and c.id = o.customer_id
      cross join lateral (
        select case
                 when c.status <> 'active' or c.anonymized_at is not null then 'customer_inactive'
                 when not core.whatsapp_marketing_granted(o.business_id, o.customer_id) then 'consent_revoked'
               end as reason
      ) b
     where o.business_id = p_business_id
       and (p_status is null or o.status = p_status)
     order by o.created_at desc, c.name
     limit 500;
end;
$$;

-- Marcar un mensaje como mandado (el dueño tocó wa.me). Vuelve a mirar el
-- consentimiento y marca al destinatario como contactado.
create function core.mark_outbox_sent(p_outbox_id uuid) returns core.outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox core.outbox;
begin
  select * into v_outbox from core.outbox where id = p_outbox_id for update;
  if not found then
    raise exception 'outbox message not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_outbox.business_id, array['owner', 'admin']);
  if v_outbox.status = 'sent' then
    return v_outbox;
  end if;
  if v_outbox.status = 'failed' then
    raise exception 'outbox_discarded' using errcode = '22023';
  end if;
  -- Misma regla que las campañas a mano: consentimiento y cliente activo.
  perform core.mark_recipient_contacted(v_outbox.recipient_id);
  update core.outbox
     set status = 'sent', sent_at = now(), sent_by = (select auth.uid()), attempts = attempts + 1
   where id = p_outbox_id
  returning * into v_outbox;
  return v_outbox;
end;
$$;

-- Descartar un mensaje (no se va a mandar). Sigue contando en los resultados de
-- su campaña como parte del grupo contactado (comparación conservadora, D-021).
create function core.discard_outbox(p_outbox_id uuid) returns core.outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox core.outbox;
begin
  select * into v_outbox from core.outbox where id = p_outbox_id for update;
  if not found then
    raise exception 'outbox message not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_outbox.business_id, array['owner', 'admin']);
  if v_outbox.status = 'sent' then
    raise exception 'outbox_already_sent' using errcode = '22023';
  end if;
  update core.outbox set status = 'failed', error = 'descartado'
   where id = p_outbox_id
  returning * into v_outbox;
  return v_outbox;
end;
$$;

-- -----------------------------------------------------------------------------
-- Motor diario con pg_cron (13:00 UTC = 10:00 en Argentina: los mensajes quedan
-- listos a la mañana). Si no hay pg_cron (tests locales), solo avisa.
-- -----------------------------------------------------------------------------
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping scheduled jobs';
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.schedule(
    'core-run-automations',
    '0 13 * * *',
    'select core.run_automations()'
  );
end
$outer$;

grant execute on function
  core.list_automations(uuid),
  core.set_automation(uuid, text, boolean, integer, text, text, integer, integer),
  core.run_business_automations(uuid),
  core.list_outbox(uuid, text),
  core.mark_outbox_sent(uuid),
  core.discard_outbox(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
