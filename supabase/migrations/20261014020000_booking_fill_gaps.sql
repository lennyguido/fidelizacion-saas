-- =============================================================================
-- BOOKING · Llenar huecos (D-053).
--
-- El panel muestra los horarios libres de un día y los clientes que no vienen
-- hace tiempo y aceptaron promociones por WhatsApp. El dueño les manda una oferta
-- desde su propio WhatsApp (link wa.me con el texto listo): no se envía nada solo.
-- * booking.book: nuevo casillero opcional "quiero recibir promociones" que queda
--   registrado en core.customer_consents (WhatsApp, marketing).
-- * booking.gap_slots y booking.lapsed_clients: solo miembros del negocio.
-- =============================================================================

drop function booking.book(text, uuid, uuid, timestamptz, text, text, boolean);

create function booking.book(p_slug text, p_service_id uuid, p_staff_id uuid,
                             p_starts_at timestamptz, p_name text, p_phone text,
                             p_terms_accepted boolean, p_promos boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
  v_result jsonb;
  v_customer uuid;
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
  v_result := booking.create_appointment(v_business.id, p_service_id, p_staff_id, p_starts_at,
                                         p_name, p_phone, 'online', null);
  if coalesce(p_promos, false) and v_result ->> 'status' = 'booked' then
    select customer_id into v_customer from booking.appointments
     where id = (v_result ->> 'appointmentId')::uuid;
    insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
    values (v_business.id, v_customer, 'whatsapp', 'marketing', true, 'customer_app');
  end if;
  return v_result;
end;
$$;

-- Servicio de referencia para medir huecos: el más pedido en 90 días; si no, el más corto.
create function booking.reference_service(p_business_id uuid) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.service_id from booking.appointments a
       join booking.services sv on sv.id = a.service_id and sv.active
      where a.business_id = p_business_id and a.starts_at > now() - interval '90 days'
      group by a.service_id order by count(*) desc limit 1),
    (select id from booking.services
      where business_id = p_business_id and active
      order by duration_minutes, sort limit 1))
$$;

-- Horarios libres de un día (para el servicio de referencia), con el profesional.
create function booking.gap_slots(p_business_id uuid, p_day date)
returns table (starts_at timestamptz, staff_id uuid, staff_name text, service_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_service uuid;
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'booking') then
    perform core.raise_forbidden('module_disabled');
  end if;
  v_service := booking.reference_service(p_business_id);
  if v_service is null then
    return;
  end if;
  return query
    select f.starts_at, f.staff_id, st.name, sv.name
      from booking.free_slots(p_business_id, v_service, null, p_day) f
      join booking.staff st on st.id = f.staff_id
      join booking.services sv on sv.id = v_service
     order by f.starts_at;
end;
$$;

-- Clientes que vinieron alguna vez, no vienen hace p_min_days días, no tienen turno
-- pendiente y aceptaron promociones por WhatsApp (último registro = sí).
create function booking.lapsed_clients(p_business_id uuid, p_min_days integer default 30)
returns table (customer_id uuid, name text, phone text, last_at timestamptz, visits bigint,
               days_away integer, last_service text)
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
    with visits as (
      select a.customer_id, max(a.starts_at) as last_at, count(*) as n
        from booking.appointments a
       where a.business_id = p_business_id and a.status = 'attended'
       group by a.customer_id
    )
    select c.id, c.name, c.phone, v.last_at, v.n,
           (extract(epoch from now() - v.last_at) / 86400)::integer,
           (select sv.name from booking.appointments a2
              join booking.services sv on sv.id = a2.service_id
             where a2.business_id = p_business_id and a2.customer_id = c.id
               and a2.status = 'attended'
             order by a2.starts_at desc limit 1)
      from visits v
      join core.customers c on c.business_id = p_business_id and c.id = v.customer_id
     where v.last_at <= now() - make_interval(days => greatest(coalesce(p_min_days, 30), 1))
       and c.status = 'active' and c.anonymized_at is null and c.phone is not null
       and not exists (select 1 from booking.appointments f
                        where f.business_id = p_business_id and f.customer_id = c.id
                          and f.status = 'booked' and f.starts_at > now())
       and coalesce((select cs.granted from core.customer_consents cs
                      where cs.business_id = p_business_id and cs.customer_id = c.id
                        and cs.channel = 'whatsapp' and cs.purpose = 'marketing'
                      order by cs.recorded_at desc limit 1), false)
     order by v.last_at desc
     limit 50;
end;
$$;

revoke execute on all functions in schema booking from public, anon, authenticated;
grant execute on function
  booking.get_public_page(text),
  booking.available_slots(text, uuid, uuid, date),
  booking.book(text, uuid, uuid, timestamptz, text, text, boolean, boolean),
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
  booking.client_history(uuid, uuid),
  booking.calendar_token(uuid, boolean),
  booking.gap_slots(uuid, date),
  booking.lapsed_clients(uuid, integer)
to authenticated;
grant execute on function booking.calendar_events(text) to service_role;
revoke execute on all functions in schema core from public, anon;
