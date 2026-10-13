-- =============================================================================
-- BOOKING · Turnos online (D-049). Producto aparte (turnos.neriva.net) sobre el
-- mismo núcleo: negocios, equipo, planes, clientes y visitas.
--
-- * Configuración del negocio: servicios, profesionales y horarios (dueño/admin).
-- * El cliente reserva sin cuenta desde turnos.neriva.net/<slug>: queda como
--   cliente del negocio (core.customers, por celular) y recibe un link secreto
--   para ver o cancelar su turno.
-- * Nunca dos turnos superpuestos para el mismo profesional (restricción en la base).
-- * "Asistió" registra la visita en el núcleo (core.record_visit_internal,
--   source 'booking'): si el negocio usa fidelización, suma sola.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

create schema if not exists booking;
revoke all on schema booking from public;
grant usage on schema booking to anon, authenticated, service_role;
alter default privileges in schema booking grant all on tables to service_role;
alter default privileges in schema booking grant all on sequences to service_role;
alter default privileges in schema booking grant execute on functions to service_role;

-- Módulo y plan propio "Turnos" (solo turnos), también en el piloto.
update core.modules set available = true where id = 'booking';
insert into core.plans (id, name) values ('turnos', 'Turnos') on conflict (id) do nothing;
update core.plans
   set features = '{"automations": false, "self_signup": false, "cash_register": false,
                    "max_customers": 5000, "max_staff": 5, "max_locations": 1}'::jsonb
 where id = 'turnos';
insert into core.plan_modules (plan_id, module_id) values
  ('turnos', 'booking'), ('turnos', 'reputation'), ('pilot', 'booking')
on conflict do nothing;
insert into core.business_modules (business_id, module_id)
select id, 'booking' from core.businesses
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------
create table booking.settings (
  business_id          uuid primary key references core.businesses (id) on delete restrict,
  enabled              boolean not null default false,
  slot_minutes         integer not null default 15 check (slot_minutes in (5, 10, 15, 20, 30, 60)),
  min_notice_minutes   integer not null default 60 check (min_notice_minutes between 0 and 10080),
  max_days_ahead       integer not null default 30 check (max_days_ahead between 1 and 180),
  cancel_notice_minutes integer not null default 120 check (cancel_notice_minutes between 0 and 10080),
  message              text check (char_length(message) <= 300),
  updated_at           timestamptz not null default now()
);

create table booking.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references core.businesses (id) on delete restrict,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_minor      bigint check (price_minor >= 0),
  active           boolean not null default true,
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (business_id, id)
);
create index services_business_idx on booking.services (business_id, sort);

create table booking.staff (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (business_id, id)
);
create index staff_business_idx on booking.staff (business_id, sort);

-- Franjas de atención por profesional y día (0 = domingo … 6 = sábado), en la hora del negocio.
create table booking.hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  staff_id    uuid not null,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  foreign key (business_id, staff_id) references booking.staff (business_id, id) on delete cascade
);
create index hours_business_idx on booking.hours (business_id, staff_id, weekday);

create table booking.appointments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references core.businesses (id) on delete restrict,
  staff_id     uuid not null,
  service_id   uuid not null,
  customer_id  uuid not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null check (ends_at > starts_at),
  status       text not null default 'booked'
               check (status in ('booked', 'cancelled', 'attended', 'no_show')),
  source       text not null default 'online' check (source in ('online', 'panel')),
  token_hash   text not null unique,
  price_minor  bigint check (price_minor >= 0),
  visit_id     uuid,
  cancelled_at timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, staff_id) references booking.staff (business_id, id) on delete restrict,
  foreign key (business_id, service_id) references booking.services (business_id, id) on delete restrict,
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict,
  -- Un profesional no puede tener dos turnos que se pisan.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status in ('booked', 'attended'))
);
create index appointments_business_idx on booking.appointments (business_id, starts_at);
create index appointments_customer_idx on booking.appointments (business_id, customer_id);
create index appointments_created_by_idx on booking.appointments (created_by) where created_by is not null;

-- -----------------------------------------------------------------------------
-- Permisos: cualquier miembro lee; la configuración la escribe dueño/admin;
-- los turnos solo cambian por funciones.
-- -----------------------------------------------------------------------------
alter table booking.settings enable row level security;
alter table booking.services enable row level security;
alter table booking.staff enable row level security;
alter table booking.hours enable row level security;
alter table booking.appointments enable row level security;

grant select, insert, update on booking.settings to authenticated;
grant select, insert, update on booking.services to authenticated;
grant select, insert, update on booking.staff to authenticated;
grant select, insert, update, delete on booking.hours to authenticated;
grant select (id, business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, source,
              price_minor, visit_id, cancelled_at, created_at)
  on booking.appointments to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['settings', 'services', 'staff', 'hours'] loop
    execute format(
      'create policy %1$s_select on booking.%1$s for select to authenticated
         using (business_id in (select core.my_business_ids_with_module(''booking'')))', t);
    execute format(
      'create policy %1$s_insert on booking.%1$s for insert to authenticated
         with check (business_id in (select core.my_business_ids_with_role(array[''owner'', ''admin'']))
                     and core.has_module(business_id, ''booking''))', t);
    execute format(
      'create policy %1$s_update on booking.%1$s for update to authenticated
         using (business_id in (select core.my_business_ids_with_role(array[''owner'', ''admin''])))
         with check (business_id in (select core.my_business_ids_with_role(array[''owner'', ''admin''])))', t);
  end loop;
end
$$;
create policy hours_delete on booking.hours for delete to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));
create policy appointments_select on booking.appointments for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('booking')));

create trigger services_audit after insert or update on booking.services
  for each row execute function core.audit_row();
create trigger staff_audit after insert or update on booking.staff
  for each row execute function core.audit_row();
create trigger appointments_audit after update on booking.appointments
  for each row execute function core.audit_row();

-- -----------------------------------------------------------------------------
-- Núcleo: buscar o crear el cliente por celular (interna, la usan los módulos).
-- -----------------------------------------------------------------------------
create function core.find_or_create_customer(p_business_id uuid, p_name text, p_phone text,
                                             p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into core.customers (business_id, name, phone, source)
  values (p_business_id, p_name, p_phone, p_source)
  on conflict (business_id, phone) where phone is not null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from core.customers where business_id = p_business_id and phone = p_phone;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Internas de booking
-- -----------------------------------------------------------------------------
create function booking.business_by_slug(p_slug text) returns core.businesses
language sql
stable
security definer
set search_path = ''
as $$
  select b.* from core.businesses b
    join booking.settings s on s.business_id = b.id and s.enabled
   where b.slug = lower(coalesce(p_slug, ''))
     and core.has_module(b.id, 'booking')
$$;

-- Horarios libres de un día para un servicio (todos los profesionales o uno).
create function booking.free_slots(p_business_id uuid, p_service_id uuid, p_staff_id uuid, p_day date)
returns table (starts_at timestamptz, staff_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select bz.timezone as tz, s.slot_minutes, s.min_notice_minutes, s.max_days_ahead,
           sv.duration_minutes
      from core.businesses bz
      join booking.settings s on s.business_id = bz.id
      join booking.services sv on sv.business_id = bz.id and sv.id = p_service_id and sv.active
     where bz.id = p_business_id
  ),
  candidates as (
    select st.id as staff_id,
           gs.t at time zone b.tz as starts_at,
           b.duration_minutes
      from b
      join booking.staff st on st.business_id = p_business_id and st.active
                            and (p_staff_id is null or st.id = p_staff_id)
      join booking.hours h on h.business_id = p_business_id and h.staff_id = st.id
                           and h.weekday = extract(dow from p_day)
      cross join lateral generate_series(
        p_day + h.start_time,
        p_day + h.end_time - make_interval(mins => b.duration_minutes),
        make_interval(mins => b.slot_minutes)) as gs(t)
     where p_day <= (now() at time zone b.tz)::date + b.max_days_ahead
  )
  select distinct on (c.starts_at) c.starts_at, c.staff_id
    from candidates c, b
   where c.starts_at >= now() + make_interval(mins => b.min_notice_minutes)
     and not exists (
       select 1 from booking.appointments a
        where a.staff_id = c.staff_id
          and a.status in ('booked', 'attended')
          and tstzrange(a.starts_at, a.ends_at) &&
              tstzrange(c.starts_at, c.starts_at + make_interval(mins => c.duration_minutes)))
   order by c.starts_at, c.staff_id
$$;

-- Crea el turno (lo usan la reserva online y el panel). Devuelve el link secreto.
create function booking.create_appointment(p_business_id uuid, p_service_id uuid, p_staff_id uuid,
                                           p_starts_at timestamptz, p_name text, p_phone text,
                                           p_source text, p_created_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name    text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone   text := btrim(coalesce(p_phone, ''));
  v_staff   uuid;
  v_service booking.services;
  v_token   text;
  v_customer uuid;
  v_id      uuid;
begin
  if char_length(v_name) not between 2 and 60 or v_name ~ '[[:cntrl:]<>]' then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return jsonb_build_object('status', 'invalid_phone');
  end if;
  select * into v_service from booking.services
   where business_id = p_business_id and id = p_service_id and active;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select f.staff_id into v_staff
    from booking.free_slots(p_business_id, p_service_id, p_staff_id,
                            (p_starts_at at time zone (select timezone from core.businesses
                                                        where id = p_business_id))::date) f
   where f.starts_at = p_starts_at
   limit 1;
  if v_staff is null then
    return jsonb_build_object('status', 'taken');
  end if;

  v_customer := core.find_or_create_customer(p_business_id, v_name, v_phone, 'booking');
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  begin
    insert into booking.appointments (business_id, staff_id, service_id, customer_id, starts_at,
                                      ends_at, source, token_hash, price_minor, created_by)
    values (p_business_id, v_staff, p_service_id, v_customer, p_starts_at,
            p_starts_at + make_interval(mins => v_service.duration_minutes), p_source,
            core.hash_token(v_token), v_service.price_minor, p_created_by)
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('status', 'taken');
  end;
  perform core.emit_event(p_business_id, 'booking.created',
                          jsonb_build_object('appointment_id', v_id, 'customer_id', v_customer));
  return jsonb_build_object('status', 'booked', 'token', v_token, 'appointmentId', v_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Públicas (anon): la página de reservas del negocio
-- -----------------------------------------------------------------------------
create function booking.get_public_page(p_slug text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
begin
  v_business := booking.business_by_slug(p_slug);
  if v_business.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'name', v_business.name,
    'logoPath', v_business.logo_path,
    'color', v_business.primary_color,
    'timezone', v_business.timezone,
    'message', (select message from booking.settings where business_id = v_business.id),
    'maxDaysAhead', (select max_days_ahead from booking.settings where business_id = v_business.id),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'durationMinutes', duration_minutes,
                                          'priceMinor', price_minor) order by sort, name)
        from booking.services where business_id = v_business.id and active), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort, name)
        from booking.staff where business_id = v_business.id and active), '[]'::jsonb));
end;
$$;

create function booking.available_slots(p_slug text, p_service_id uuid, p_staff_id uuid, p_day date)
returns table (starts_at timestamptz, staff_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
begin
  v_business := booking.business_by_slug(p_slug);
  if v_business.id is null then
    return;
  end if;
  return query select * from booking.free_slots(v_business.id, p_service_id, p_staff_id, p_day);
end;
$$;

-- Reserva online. Límite: 20 reservas online por hora por negocio.
create function booking.book(p_slug text, p_service_id uuid, p_staff_id uuid,
                             p_starts_at timestamptz, p_name text, p_phone text,
                             p_terms_accepted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
begin
  if coalesce(p_terms_accepted, false) is not true then
    return jsonb_build_object('status', 'terms_required');
  end if;
  v_business := booking.business_by_slug(p_slug);
  if v_business.id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;
  -- Serializa las reservas del negocio: el límite no se pasa con pedidos simultáneos.
  perform 1 from booking.settings where business_id = v_business.id for update;
  if (select count(*) from booking.appointments
       where business_id = v_business.id and source = 'online'
         and created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  return booking.create_appointment(v_business.id, p_service_id, p_staff_id, p_starts_at,
                                    p_name, p_phone, 'online', null);
end;
$$;

-- Lo que ve el cliente con su link secreto.
create function booking.get_appointment(p_token text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'status', a.status, 'startsAt', a.starts_at, 'endsAt', a.ends_at,
           'serviceName', sv.name, 'staffName', st.name, 'businessName', b.name,
           'businessSlug', b.slug, 'timezone', b.timezone, 'priceMinor', a.price_minor,
           'canCancel', a.status = 'booked'
                        and a.starts_at - now() >= make_interval(mins => s.cancel_notice_minutes),
           'cancelNoticeMinutes', s.cancel_notice_minutes)
    from booking.appointments a
    join booking.services sv on sv.id = a.service_id
    join booking.staff st on st.id = a.staff_id
    join core.businesses b on b.id = a.business_id
    join booking.settings s on s.business_id = a.business_id
   where a.token_hash = core.hash_token(coalesce(p_token, ''))
$$;

create function booking.cancel_by_customer(p_token text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt booking.appointments;
  v_notice integer;
begin
  select * into v_appt from booking.appointments
   where token_hash = core.hash_token(coalesce(p_token, '')) for update;
  if not found then
    return 'not_found';
  end if;
  if v_appt.status <> 'booked' then
    return 'not_booked';
  end if;
  select cancel_notice_minutes into v_notice from booking.settings where business_id = v_appt.business_id;
  if v_appt.starts_at - now() < make_interval(mins => v_notice) then
    return 'too_late';
  end if;
  update booking.appointments set status = 'cancelled', cancelled_at = now() where id = v_appt.id;
  perform core.emit_event(v_appt.business_id, 'booking.cancelled',
                          jsonb_build_object('appointment_id', v_appt.id, 'by', 'customer'));
  return 'cancelled';
end;
$$;

-- -----------------------------------------------------------------------------
-- Panel
-- -----------------------------------------------------------------------------
-- Agenda entre dos fechas (cualquier miembro), con el nombre y celular del cliente.
create function booking.agenda(p_business_id uuid, p_from date, p_to date)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status text, source text,
               staff_id uuid, staff_name text, service_name text, price_minor bigint,
               customer_id uuid, customer_name text, customer_phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'booking') then
    perform core.raise_forbidden('module_disabled');
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select bz.timezone into v_tz from core.businesses bz where bz.id = p_business_id;
  return query
    select a.id, a.starts_at, a.ends_at, a.status, a.source, a.staff_id, st.name, sv.name,
           a.price_minor, c.id, c.name, c.phone
      from booking.appointments a
      join booking.staff st on st.id = a.staff_id
      join booking.services sv on sv.id = a.service_id
      join core.customers c on c.id = a.customer_id
     where a.business_id = p_business_id
       and a.starts_at >= p_from::timestamp at time zone v_tz
       and a.starts_at < (p_to + 1)::timestamp at time zone v_tz
     order by a.starts_at, st.name;
end;
$$;

-- Turno cargado desde el panel (por ejemplo, alguien que llamó por teléfono).
create function booking.book_from_panel(p_business_id uuid, p_service_id uuid, p_staff_id uuid,
                                        p_starts_at timestamptz, p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'booking') then
    perform core.raise_forbidden('module_disabled');
  end if;
  return booking.create_appointment(p_business_id, p_service_id, p_staff_id, p_starts_at,
                                    p_name, p_phone, 'panel', (select auth.uid()))
         - 'token';
end;
$$;

-- Asistió / no vino / cancelado. "Asistió" registra la visita en el núcleo.
create function booking.set_status(p_appointment_id uuid, p_status text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt booking.appointments;
  v_visit core.visits;
begin
  if p_status not in ('cancelled', 'attended', 'no_show') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  select * into v_appt from booking.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_appt.business_id);
  if v_appt.status <> 'booked' then
    raise exception 'appointment is not pending' using errcode = '22023';
  end if;
  if p_status = 'attended' then
    v_visit := core.record_visit_internal(v_appt.business_id, null, v_appt.customer_id,
                                          v_appt.price_minor, least(v_appt.starts_at, now()),
                                          'booking', v_appt.id::text, null, (select auth.uid()));
  end if;
  update booking.appointments
     set status = p_status,
         visit_id = v_visit.id,
         cancelled_at = case when p_status = 'cancelled' then now() end
   where id = p_appointment_id;
  return p_status;
end;
$$;

revoke execute on all functions in schema booking from public, anon, authenticated;
revoke execute on all functions in schema core from public, anon;

grant execute on function
  booking.get_public_page(text),
  booking.available_slots(text, uuid, uuid, date),
  booking.book(text, uuid, uuid, timestamptz, text, text, boolean),
  booking.get_appointment(text),
  booking.cancel_by_customer(text)
to anon, authenticated;
grant execute on function
  booking.agenda(uuid, date, date),
  booking.book_from_panel(uuid, uuid, uuid, timestamptz, text, text),
  booking.set_status(uuid, text)
to authenticated;
