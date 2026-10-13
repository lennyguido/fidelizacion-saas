-- =============================================================================
-- BOOKING · Reprogramar, mover turnos y clientes con historial (D-050).
--
-- * El cliente reprograma con su link (mismas reglas que cancelar y que reservar).
-- * El local mueve un turno desde el calendario (otro horario u otro profesional;
--   la base sigue impidiendo superposiciones).
-- * Clientes de Turnos: cuántas veces reservó, vino, faltó, cuánto gastó, último y
--   próximo turno, y el historial de cada uno.
-- =============================================================================

-- Lo que ve el cliente con su link: ahora también los datos para reprogramar.
create or replace function booking.get_appointment(p_token text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'status', a.status, 'startsAt', a.starts_at, 'endsAt', a.ends_at,
           'serviceId', a.service_id, 'staffId', a.staff_id,
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

-- Reprogramar con el link: mismo servicio, nuevo horario libre (mismo profesional
-- si está libre; si no, cualquiera). Solo con la anticipación para cancelar.
create function booking.reschedule(p_token text, p_starts_at timestamptz) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt booking.appointments;
  v_notice integer;
  v_tz text;
  v_staff uuid;
  v_minutes integer;
begin
  select * into v_appt from booking.appointments
   where token_hash = core.hash_token(coalesce(p_token, '')) for update;
  if not found then
    return 'not_found';
  end if;
  if v_appt.status <> 'booked' then
    return 'not_booked';
  end if;
  select s.cancel_notice_minutes, b.timezone into v_notice, v_tz
    from booking.settings s join core.businesses b on b.id = s.business_id
   where s.business_id = v_appt.business_id and s.enabled;
  if not found then
    return 'unavailable';
  end if;
  if v_appt.starts_at - now() < make_interval(mins => v_notice) then
    return 'too_late';
  end if;

  -- Se libera el horario actual para que cuente como libre, y se busca el nuevo.
  update booking.appointments set status = 'cancelled' where id = v_appt.id;
  select f.staff_id into v_staff
    from booking.free_slots(v_appt.business_id, v_appt.service_id, null,
                            (p_starts_at at time zone v_tz)::date) f
   where f.starts_at = p_starts_at
   order by (f.staff_id = v_appt.staff_id) desc
   limit 1;
  if v_staff is null then
    update booking.appointments set status = 'booked' where id = v_appt.id;
    return 'taken';
  end if;
  v_minutes := extract(epoch from v_appt.ends_at - v_appt.starts_at)::integer / 60;
  begin
    update booking.appointments
       set status = 'booked', staff_id = v_staff, starts_at = p_starts_at,
           ends_at = p_starts_at + make_interval(mins => v_minutes)
     where id = v_appt.id;
  exception when exclusion_violation then
    update booking.appointments set status = 'booked' where id = v_appt.id;
    return 'taken';
  end;
  perform core.emit_event(v_appt.business_id, 'booking.rescheduled',
                          jsonb_build_object('appointment_id', v_appt.id, 'by', 'customer'));
  return 'rescheduled';
end;
$$;

-- Mover un turno desde el calendario (cualquier miembro). Puede quedar fuera del
-- horario de atención (lo decide el local), pero nunca encima de otro turno.
create function booking.move_appointment(p_appointment_id uuid, p_staff_id uuid,
                                         p_starts_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt booking.appointments;
  v_minutes integer;
begin
  select * into v_appt from booking.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_appt.business_id);
  if v_appt.status <> 'booked' then
    raise exception 'appointment is not pending' using errcode = '22023';
  end if;
  if not exists (select 1 from booking.staff
                  where business_id = v_appt.business_id and id = p_staff_id and active) then
    raise exception 'staff not found' using errcode = 'P0002';
  end if;
  v_minutes := extract(epoch from v_appt.ends_at - v_appt.starts_at)::integer / 60;
  begin
    update booking.appointments
       set staff_id = p_staff_id, starts_at = p_starts_at,
           ends_at = p_starts_at + make_interval(mins => v_minutes)
     where id = p_appointment_id;
  exception when exclusion_violation then
    return 'taken';
  end;
  return 'moved';
end;
$$;

-- Clientes que reservaron alguna vez (con búsqueda por nombre o celular).
create function booking.clients(p_business_id uuid, p_search text default null)
returns table (customer_id uuid, name text, phone text, bookings bigint, attended bigint,
               no_shows bigint, spent_minor bigint, last_at timestamptz, next_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'booking') then
    perform core.raise_forbidden('module_disabled');
  end if;
  return query
    select c.id, c.name, c.phone,
           count(*),
           count(*) filter (where a.status = 'attended'),
           count(*) filter (where a.status = 'no_show'),
           coalesce(sum(a.price_minor) filter (where a.status = 'attended'), 0)::bigint,
           max(a.starts_at) filter (where a.starts_at <= now() and a.status <> 'cancelled'),
           min(a.starts_at) filter (where a.starts_at > now() and a.status = 'booked')
      from booking.appointments a
      join core.customers c on c.id = a.customer_id
     where a.business_id = p_business_id
       and (v_q is null or c.name ilike '%' || v_q || '%' or c.phone like '%' || v_q || '%')
     group by c.id, c.name, c.phone
     order by max(a.starts_at) desc
     limit 200;
end;
$$;

create function booking.client_history(p_business_id uuid, p_customer_id uuid)
returns table (id uuid, starts_at timestamptz, status text, service_name text, staff_name text,
               price_minor bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'booking') then
    perform core.raise_forbidden('module_disabled');
  end if;
  return query
    select a.id, a.starts_at, a.status, sv.name, st.name, a.price_minor
      from booking.appointments a
      join booking.services sv on sv.id = a.service_id
      join booking.staff st on st.id = a.staff_id
     where a.business_id = p_business_id and a.customer_id = p_customer_id
     order by a.starts_at desc
     limit 100;
end;
$$;

revoke execute on all functions in schema booking from public, anon, authenticated;
grant execute on function
  booking.get_public_page(text),
  booking.available_slots(text, uuid, uuid, date),
  booking.book(text, uuid, uuid, timestamptz, text, text, boolean),
  booking.get_appointment(text),
  booking.cancel_by_customer(text),
  booking.reschedule(text, timestamptz)
to anon, authenticated;
grant execute on function
  booking.agenda(uuid, date, date),
  booking.book_from_panel(uuid, uuid, uuid, timestamptz, text, text),
  booking.set_status(uuid, text),
  booking.move_appointment(uuid, uuid, timestamptz),
  booking.clients(uuid, text),
  booking.client_history(uuid, uuid)
to authenticated;
revoke execute on all functions in schema core from public, anon;
