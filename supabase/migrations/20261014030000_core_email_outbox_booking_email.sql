-- =============================================================================
-- CORE · Mails transaccionales (D-055) + BOOKING · "Mandámelo por mail".
--
-- * core.email_outbox: bandeja de salida de mails del núcleo (solo funciones; la
--   lee y despacha la Edge Function `send-email` con la clave del proveedor).
--   El contenido (con el link secreto del turno) se borra apenas se envía o vence.
--   Un mail que no salió en 2 horas vence: no se manda una confirmación tarde.
-- * booking.send_by_email: el cliente, con su link secreto, pide que le manden el
--   turno por mail (máximo 3 por turno). Guarda el mail en su ficha.
-- * booking.get_appointment: ahora también devuelve el color y el logo del negocio.
-- =============================================================================

create table core.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  customer_id uuid,
  kind        text not null check (kind in ('booking_confirmation')),
  ref         text not null check (char_length(ref) <= 100),
  to_email    text not null check (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(to_email) <= 254),
  payload     jsonb,
  status      text not null default 'queued'
              check (status in ('queued', 'sending', 'sent', 'failed', 'expired')),
  attempts    integer not null default 0,
  error       text check (char_length(error) <= 500),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (business_id, id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict
);
create index email_outbox_business_idx on core.email_outbox (business_id);
create index email_outbox_customer_idx on core.email_outbox (business_id, customer_id);
create index email_outbox_queue_idx on core.email_outbox (status, created_at);
create index email_outbox_ref_idx on core.email_outbox (ref);
alter table core.email_outbox enable row level security;

-- Encola un mail (interna: la llaman funciones de los módulos).
create function core.queue_email(p_business_id uuid, p_customer_id uuid, p_to text,
                                 p_kind text, p_ref text, p_payload jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into core.email_outbox (business_id, customer_id, to_email, kind, ref, payload)
  values (p_business_id, p_customer_id, lower(btrim(p_to)), p_kind, p_ref, p_payload)
  returning id
$$;

-- Para la Edge Function: vence lo viejo y toma hasta p_limit mails pendientes.
create function core.email_batch(p_limit integer default 20)
returns table (id uuid, kind text, to_email text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update core.email_outbox
     set status = 'expired', payload = null
   where status in ('queued', 'sending') and created_at < now() - interval '2 hours';
  return query
    update core.email_outbox o
       set status = 'sending', attempts = o.attempts + 1
     where o.id in (select q.id from core.email_outbox q
                     where q.status = 'queued'
                     order by q.created_at
                     limit least(greatest(coalesce(p_limit, 20), 1), 50)
                     for update skip locked)
    returning o.id, o.kind, o.to_email, o.payload;
end;
$$;

-- Resultado del envío. Si salió (o falló 3 veces) se borra el contenido.
create function core.email_result(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update core.email_outbox
     set status = case when p_ok then 'sent' when attempts >= 3 then 'failed' else 'queued' end,
         sent_at = case when p_ok then now() end,
         error = left(p_error, 500),
         payload = case when p_ok or attempts >= 3 then null else payload end
   where id = p_id and status = 'sending'
$$;

-- El cliente pide su turno por mail (con el link secreto).
create function booking.send_by_email(p_token text, p_email text) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_appt  booking.appointments;
  v_view  jsonb;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    return 'invalid_email';
  end if;
  select * into v_appt from booking.appointments
   where token_hash = core.hash_token(coalesce(p_token, ''));
  if not found then
    return 'not_found';
  end if;
  if (select count(*) from core.email_outbox
       where ref = 'booking:' || v_appt.id::text) >= 3 then
    return 'limit';
  end if;
  update core.customers set email = v_email
   where business_id = v_appt.business_id and id = v_appt.customer_id;
  v_view := booking.get_appointment(p_token)
            || jsonb_build_object('link', 'https://turnos.neriva.net/turno#' || p_token,
                                  'customerName', (select name from core.customers
                                                    where id = v_appt.customer_id));
  perform core.queue_email(v_appt.business_id, v_appt.customer_id, v_email,
                           'booking_confirmation', 'booking:' || v_appt.id::text, v_view);
  return 'queued';
end;
$$;

-- Lo que ve el cliente con su link: ahora también color y logo del negocio.
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
           'color', b.primary_color, 'logoPath', b.logo_path,
           'message', s.message,
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

revoke execute on function core.queue_email(uuid, uuid, text, text, text, jsonb),
  core.email_batch(integer), core.email_result(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function core.email_batch(integer), core.email_result(uuid, boolean, text)
  to service_role;
revoke execute on function booking.send_by_email(text, text) from public;
grant execute on function booking.send_by_email(text, text), booking.get_appointment(text)
  to anon, authenticated;
revoke execute on all functions in schema core from public, anon;
