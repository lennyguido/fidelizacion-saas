-- =============================================================================
-- CORE · Visitas (el dato central), estadísticas y estados del cliente, eventos.
-- Ver docs/ARCHITECTURE.md §5, §6 y §12. Decisiones D-006, D-008, D-010.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Eventos (outbox). Los módulos reaccionan a estos eventos.
-- -----------------------------------------------------------------------------

create table core.events (
  id           bigint generated always as identity primary key,
  business_id  uuid not null references core.businesses (id) on delete restrict,
  type         text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz
);

create index events_business_idx on core.events (business_id, occurred_at desc);
create index events_unprocessed_idx on core.events (id) where processed_at is null;

create function core.emit_event(p_business_id uuid, p_type text, p_payload jsonb default '{}')
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into core.events (business_id, type, payload)
  values (p_business_id, p_type, coalesce(p_payload, '{}'::jsonb))
  returning id
$$;

-- -----------------------------------------------------------------------------
-- Visitas
-- -----------------------------------------------------------------------------

create table core.visits (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references core.businesses (id) on delete restrict,
  location_id  uuid not null,
  customer_id  uuid,
  occurred_at  timestamptz not null default now(),
  amount_minor bigint check (amount_minor between 0 and 1000000000000),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  source       text not null
               check (source in ('manual', 'qr_customer', 'qr_business', 'booking', 'import',
                                 'mercadopago', 'pos')),
  source_ref   text check (char_length(source_ref) between 1 and 200),
  notes        text check (char_length(notes) <= 500),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id) on delete set null,
  void_reason  text check (char_length(void_reason) between 3 and 500),
  unique (business_id, id),
  foreign key (business_id, location_id) references core.locations (business_id, id),
  foreign key (business_id, customer_id) references core.customers (business_id, id),
  check ((voided_at is null) = (void_reason is null))
);

comment on column core.visits.amount_minor is 'Monto en unidades menores (centavos). Null = sin monto.';

create index visits_business_time_idx on core.visits (business_id, occurred_at desc);
create index visits_customer_time_idx on core.visits (business_id, customer_id, occurred_at desc)
  where customer_id is not null;
create unique index visits_idempotency_idx on core.visits (business_id, source, source_ref)
  where source_ref is not null;

-- -----------------------------------------------------------------------------
-- Estadísticas y estados del cliente
-- -----------------------------------------------------------------------------

create table core.customer_stats (
  customer_id            uuid primary key,
  business_id            uuid not null references core.businesses (id) on delete restrict,
  first_visit_at         timestamptz,
  last_visit_at          timestamptz,
  visit_count            integer not null default 0 check (visit_count >= 0),
  total_spend_minor      bigint not null default 0 check (total_spend_minor >= 0),
  spend_visit_count      integer not null default 0 check (spend_visit_count >= 0),
  avg_ticket_minor       bigint,
  median_interval_days   numeric(8, 2),
  expected_next_visit_at timestamptz,
  status                 text not null default 'NEW'
                         check (status in ('NEW', 'ACTIVE', 'AT_RISK', 'INACTIVE', 'RECOVERED')),
  risk_score             smallint not null default 0 check (risk_score between 0 and 100),
  status_changed_at      timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (business_id, customer_id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete cascade
);

create index customer_stats_status_idx on core.customer_stats (business_id, status);
create index customer_stats_next_visit_idx on core.customer_stats (business_id, expected_next_visit_at);

create table core.customer_status_history (
  id          bigint generated always as identity primary key,
  business_id uuid not null references core.businesses (id) on delete restrict,
  customer_id uuid not null,
  from_status text,
  to_status   text not null,
  reason      text not null check (reason in ('created', 'visit', 'schedule', 'void', 'import')),
  changed_at  timestamptz not null default now(),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete cascade
);

create index customer_status_history_idx
  on core.customer_status_history (business_id, customer_id, changed_at desc);

-- Configuración por negocio (businesses.settings -> 'customer_status'), con defaults.
create function core.status_settings(p_settings jsonb) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'default_interval_days', 14,
    'at_risk_factor',        1.5,
    'inactive_factor',       3.0,
    'new_days',              30,
    'recovered_days',        30,
    'visit_dedupe_seconds',  120
  ) || coalesce(p_settings -> 'customer_status', '{}'::jsonb)
$$;

-- Función pura: calcula estado y riesgo. Sin acceso a tablas → fácil de testear.
--
-- intervalo esperado = mediana de días entre visitas (si hay >= 3 visitas), si no el default
-- ratio            = días desde la última visita / intervalo esperado
-- riesgo (0..100)  = 0 hasta ratio 1, sube lineal hasta 100 en ratio = inactive_factor
-- INACTIVE si ratio > inactive_factor · AT_RISK si ratio > at_risk_factor
-- RECOVERED si vuelve estando AT_RISK/INACTIVE; dura recovered_days
-- NEW si tiene 0 visitas, o 1 visita dentro de new_days
create function core.compute_customer_status(
  p_visit_count       integer,
  p_first_visit_at    timestamptz,
  p_last_visit_at     timestamptz,
  p_median_interval   numeric,
  p_prev_status       text,
  p_prev_changed_at   timestamptz,
  p_is_new_visit      boolean,
  p_settings          jsonb,
  p_now               timestamptz,
  out status          text,
  out risk_score      smallint,
  out interval_days   numeric
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  s          jsonb := core.status_settings(p_settings);
  f_risk     numeric := (s ->> 'at_risk_factor')::numeric;
  f_inactive numeric := (s ->> 'inactive_factor')::numeric;
  v_ratio    numeric;
begin
  if coalesce(p_visit_count, 0) = 0 or p_last_visit_at is null then
    status := 'NEW';
    risk_score := 0;
    interval_days := null;
    return;
  end if;

  interval_days := case
    when p_visit_count >= 3 and p_median_interval is not null then greatest(p_median_interval, 1)
    else (s ->> 'default_interval_days')::numeric
  end;

  v_ratio := greatest(extract(epoch from (p_now - p_last_visit_at)), 0) / 86400.0 / interval_days;
  risk_score := least(100, greatest(0, round((v_ratio - 1) / (f_inactive - 1) * 100)))::smallint;

  if v_ratio > f_inactive then
    status := 'INACTIVE';
  elsif v_ratio > f_risk then
    status := 'AT_RISK';
  elsif p_is_new_visit and p_prev_status in ('AT_RISK', 'INACTIVE') then
    status := 'RECOVERED';
  elsif p_prev_status = 'RECOVERED'
        and p_now - p_prev_changed_at < make_interval(days => (s ->> 'recovered_days')::int) then
    status := 'RECOVERED';
  elsif p_visit_count = 1
        and p_now - p_first_visit_at < make_interval(days => (s ->> 'new_days')::int) then
    status := 'NEW';
  else
    status := 'ACTIVE';
  end if;
end;
$$;

-- Recalcula las estadísticas de un cliente desde sus visitas válidas.
create function core.refresh_customer_stats(
  p_customer_id   uuid,
  p_reason        text,
  p_prev_status   text default null,
  p_is_new_visit  boolean default false
) returns core.customer_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business   core.businesses;
  v_customer   core.customers;
  v_old        core.customer_stats;
  v_agg        record;
  v_median     numeric;
  v_calc       record;
  v_new        core.customer_stats;
begin
  select * into v_customer from core.customers where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  select * into v_business from core.businesses where id = v_customer.business_id;
  select * into v_old from core.customer_stats where customer_id = p_customer_id for update;

  select count(*)::int                         as visit_count,
         min(occurred_at)                      as first_visit_at,
         max(occurred_at)                      as last_visit_at,
         coalesce(sum(amount_minor), 0)::bigint as total_spend_minor,
         count(amount_minor)::int              as spend_visit_count,
         round(avg(amount_minor))::bigint      as avg_ticket_minor
    into v_agg
    from core.visits
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and voided_at is null;

  -- Mediana de días entre días distintos con visita (hora local), últimas 21 fechas.
  select percentile_cont(0.5) within group (order by gap)
    into v_median
    from (
      select day - lag(day) over (order by day) as gap
        from (
          select day
            from (
              select distinct (occurred_at at time zone v_business.timezone)::date as day
                from core.visits
               where business_id = v_customer.business_id
                 and customer_id = p_customer_id
                 and voided_at is null
            ) days
           order by day desc
           limit 21
        ) recent
    ) gaps
   where gap is not null;

  select * into v_calc from core.compute_customer_status(
    v_agg.visit_count,
    v_agg.first_visit_at,
    v_agg.last_visit_at,
    v_median,
    coalesce(p_prev_status, v_old.status, 'NEW'),
    coalesce(v_old.status_changed_at, now()),
    p_is_new_visit,
    v_business.settings,
    now()
  );

  insert into core.customer_stats as cs (
    customer_id, business_id, first_visit_at, last_visit_at, visit_count, total_spend_minor,
    spend_visit_count, avg_ticket_minor, median_interval_days, expected_next_visit_at,
    status, risk_score, status_changed_at, updated_at
  ) values (
    p_customer_id, v_customer.business_id, v_agg.first_visit_at, v_agg.last_visit_at,
    v_agg.visit_count, v_agg.total_spend_minor, v_agg.spend_visit_count, v_agg.avg_ticket_minor,
    round(v_median, 2),
    v_agg.last_visit_at + make_interval(secs => coalesce(v_calc.interval_days, 0) * 86400),
    v_calc.status, v_calc.risk_score, now(), now()
  )
  on conflict (customer_id) do update set
    first_visit_at         = excluded.first_visit_at,
    last_visit_at          = excluded.last_visit_at,
    visit_count            = excluded.visit_count,
    total_spend_minor      = excluded.total_spend_minor,
    spend_visit_count      = excluded.spend_visit_count,
    avg_ticket_minor       = excluded.avg_ticket_minor,
    median_interval_days   = excluded.median_interval_days,
    expected_next_visit_at = case when excluded.visit_count > 0
                                  then excluded.expected_next_visit_at end,
    status                 = excluded.status,
    risk_score             = excluded.risk_score,
    status_changed_at      = case when cs.status is distinct from excluded.status
                                  then now() else cs.status_changed_at end,
    updated_at             = now()
  returning * into v_new;

  if v_old.status is distinct from v_new.status then
    insert into core.customer_status_history (business_id, customer_id, from_status, to_status, reason)
    values (v_customer.business_id, p_customer_id, v_old.status, v_new.status, p_reason);

    perform core.emit_event(v_customer.business_id, 'customer.status_changed', jsonb_build_object(
      'customer_id', p_customer_id, 'from', v_old.status, 'to', v_new.status, 'reason', p_reason));
  end if;

  return v_new;
end;
$$;

-- Todo cliente nuevo nace con su fila de estadísticas (estado NEW).
create function core.init_customer_stats() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into core.customer_stats (customer_id, business_id) values (new.id, new.business_id);
  insert into core.customer_status_history (business_id, customer_id, from_status, to_status, reason)
  values (new.business_id, new.id, null, 'NEW', 'created');
  return new;
end;
$$;

create trigger customers_init_stats after insert on core.customers
  for each row execute function core.init_customer_stats();

-- Recalcula estado y riesgo de todos (o de un negocio). "No venir" no genera
-- eventos, así que esto corre todas las noches (pg_cron).
create function core.refresh_statuses(p_business_id uuid default null) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  with calc as (
    select s.customer_id, s.business_id, s.status as old_status, c.status as new_status,
           c.risk_score as new_risk
      from core.customer_stats s
      join core.businesses b on b.id = s.business_id
      cross join lateral core.compute_customer_status(
        s.visit_count, s.first_visit_at, s.last_visit_at, s.median_interval_days,
        s.status, s.status_changed_at, false, b.settings, now()
      ) c
     where (p_business_id is null or s.business_id = p_business_id)
       and b.status = 'active'
  ), upd as (
    update core.customer_stats s
       set status = c.new_status,
           risk_score = c.new_risk,
           status_changed_at = case when s.status <> c.new_status then now() else s.status_changed_at end,
           updated_at = now()
      from calc c
     where s.customer_id = c.customer_id
       and (s.status <> c.new_status or s.risk_score <> c.new_risk)
    returning s.customer_id, s.business_id, c.old_status, c.new_status
  ), hist as (
    insert into core.customer_status_history (business_id, customer_id, from_status, to_status, reason)
    select business_id, customer_id, old_status, new_status, 'schedule'
      from upd where old_status <> new_status
    returning business_id, customer_id, from_status, to_status
  ), ev as (
    insert into core.events (business_id, type, payload)
    select business_id, 'customer.status_changed', jsonb_build_object(
             'customer_id', customer_id, 'from', from_status, 'to', to_status, 'reason', 'schedule')
      from hist
    returning 1
  )
  select count(*) into v_changed from hist;

  return v_changed;
end;
$$;

-- -----------------------------------------------------------------------------
-- Registrar visitas: la ÚNICA forma de crear visitas (D-006).
-- -----------------------------------------------------------------------------

-- Variante interna, sin chequeo de usuario: la usan funciones de módulos e
-- integraciones (service_role). No se expone a usuarios.
create function core.record_visit_internal(
  p_business_id  uuid,
  p_location_id  uuid,
  p_customer_id  uuid,
  p_amount_minor bigint,
  p_occurred_at  timestamptz,
  p_source       text,
  p_source_ref   text,
  p_notes        text,
  p_created_by   uuid
) returns core.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business    core.businesses;
  v_location_id uuid := p_location_id;
  v_customer    core.customers;
  v_stats       core.customer_stats;
  v_settings    jsonb;
  v_occurred_at timestamptz := coalesce(p_occurred_at, now());
  v_prev_status text;
  v_is_new      boolean := false;
  v_visit       core.visits;
begin
  select * into v_business from core.businesses where id = p_business_id;
  if not found or v_business.status <> 'active' then
    raise exception 'business not found or inactive' using errcode = 'P0002';
  end if;
  v_settings := core.status_settings(v_business.settings);

  -- Fecha válida: nunca futura; atrasada hasta 7 días salvo importaciones.
  if v_occurred_at > now() + interval '5 minutes' then
    raise exception 'occurred_at cannot be in the future' using errcode = '22023';
  end if;
  if p_source <> 'import' and v_occurred_at < now() - interval '7 days' then
    raise exception 'occurred_at older than 7 days requires source import' using errcode = '22023';
  end if;
  if p_amount_minor is not null and p_amount_minor < 0 then
    raise exception 'amount_minor must be >= 0' using errcode = '22023';
  end if;

  -- Sucursal: la indicada (del mismo negocio y activa) o la única activa.
  if v_location_id is null then
    select id into v_location_id from core.locations
     where business_id = p_business_id and active;
    if (select count(*) from core.locations where business_id = p_business_id and active) <> 1 then
      raise exception 'location_id is required for businesses with several locations'
        using errcode = '22023';
    end if;
  elsif not exists (select 1 from core.locations
                     where id = v_location_id and business_id = p_business_id and active) then
    raise exception 'location not found' using errcode = 'P0002';
  end if;

  -- Idempotencia por referencia externa: devolver la visita ya registrada.
  if p_source_ref is not null then
    select * into v_visit from core.visits
     where business_id = p_business_id and source = p_source and source_ref = p_source_ref;
    if found then
      return v_visit;
    end if;
  end if;

  if p_customer_id is not null then
    -- Bloquea al cliente: serializa visitas concurrentes del mismo cliente.
    select * into v_customer from core.customers
     where id = p_customer_id and business_id = p_business_id
     for update;
    if not found or v_customer.status <> 'active' or v_customer.anonymized_at is not null then
      raise exception 'customer not found' using errcode = 'P0002';
    end if;

    -- Evita la doble carga accidental en mostrador.
    if p_source in ('manual', 'qr_customer', 'qr_business') and exists (
      select 1 from core.visits
       where business_id = p_business_id
         and customer_id = p_customer_id
         and voided_at is null
         and abs(extract(epoch from (occurred_at - v_occurred_at)))
             < (v_settings ->> 'visit_dedupe_seconds')::int
    ) then
      raise exception 'duplicate_visit: this customer already has a visit a moment ago'
        using errcode = '23505';
    end if;

    select * into v_stats from core.customer_stats where customer_id = p_customer_id;

    -- ¿Esta visita es "la vuelta"? Se mira cómo estaba el cliente justo antes.
    if p_source <> 'import'
       and (v_stats.last_visit_at is null or v_occurred_at >= v_stats.last_visit_at) then
      v_is_new := true;
      select c.status into v_prev_status
        from core.compute_customer_status(
          v_stats.visit_count, v_stats.first_visit_at, v_stats.last_visit_at,
          v_stats.median_interval_days, v_stats.status, v_stats.status_changed_at,
          false, v_business.settings, v_occurred_at
        ) c;
    end if;
  end if;

  insert into core.visits (business_id, location_id, customer_id, occurred_at, amount_minor,
                           currency, source, source_ref, notes, created_by)
  values (p_business_id, v_location_id, p_customer_id, v_occurred_at, p_amount_minor,
          v_business.currency, p_source, p_source_ref, nullif(btrim(p_notes), ''), p_created_by)
  on conflict (business_id, source, source_ref) where source_ref is not null do nothing
  returning * into v_visit;

  if v_visit.id is null then
    -- Otra transacción la insertó en paralelo con la misma referencia.
    select * into v_visit from core.visits
     where business_id = p_business_id and source = p_source and source_ref = p_source_ref;
    return v_visit;
  end if;

  if p_customer_id is not null then
    perform core.refresh_customer_stats(
      p_customer_id,
      case when p_source = 'import' then 'import' else 'visit' end,
      v_prev_status,
      v_is_new
    );
  end if;

  perform core.emit_event(p_business_id, 'visit.recorded', jsonb_build_object(
    'visit_id', v_visit.id,
    'customer_id', v_visit.customer_id,
    'location_id', v_visit.location_id,
    'amount_minor', v_visit.amount_minor,
    'source', v_visit.source,
    'occurred_at', v_visit.occurred_at
  ));

  return v_visit;
end;
$$;

-- Variante pública para el equipo del negocio (mostrador, QR).
create function core.record_visit(
  p_business_id  uuid,
  p_location_id  uuid default null,
  p_customer_id  uuid default null,
  p_amount_minor bigint default null,
  p_occurred_at  timestamptz default null,
  p_source       text default 'manual',
  p_source_ref   text default null,
  p_notes        text default null
) returns core.visits
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source is null or p_source not in ('manual', 'qr_customer', 'qr_business', 'import') then
    raise exception 'source % is reserved for integrations', p_source using errcode = '22023';
  end if;

  if p_source = 'import' then
    perform core.require_member(p_business_id, array['owner', 'admin']);
  else
    perform core.require_member(p_business_id);
  end if;

  return core.record_visit_internal(p_business_id, p_location_id, p_customer_id, p_amount_minor,
                                    p_occurred_at, p_source, p_source_ref, p_notes,
                                    (select auth.uid()));
end;
$$;

-- Anular una visita cargada por error (no se borra: queda el registro).
create function core.void_visit(p_visit_id uuid, p_reason text) returns core.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit core.visits;
begin
  select * into v_visit from core.visits where id = p_visit_id for update;
  if not found then
    raise exception 'visit not found' using errcode = 'P0002';
  end if;

  perform core.require_member(v_visit.business_id, array['owner', 'admin']);

  if v_visit.voided_at is not null then
    raise exception 'visit already voided' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  update core.visits
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = p_visit_id
  returning * into v_visit;

  if v_visit.customer_id is not null then
    perform core.refresh_customer_stats(v_visit.customer_id, 'void');
  end if;

  perform core.emit_event(v_visit.business_id, 'visit.voided', jsonb_build_object(
    'visit_id', v_visit.id, 'customer_id', v_visit.customer_id, 'reason', v_visit.void_reason));

  return v_visit;
end;
$$;

grant execute on function
  core.record_visit(uuid, uuid, uuid, bigint, timestamptz, text, text, text),
  core.void_visit(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: lectura para el equipo (y el propio cliente); escritura solo por funciones.
-- -----------------------------------------------------------------------------

alter table core.events enable row level security;
alter table core.visits enable row level security;
alter table core.customer_stats enable row level security;
alter table core.customer_status_history enable row level security;

grant select on core.visits, core.customer_stats, core.customer_status_history to authenticated;

create policy visits_select on core.visits
  for select to authenticated
  using (
    business_id in (select core.my_business_ids())
    or customer_id in (select core.my_customer_ids())
  );

create policy customer_stats_select on core.customer_stats
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

create policy customer_status_history_select on core.customer_status_history
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

-- core.events: RLS sin policies → solo procesos internos.

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
