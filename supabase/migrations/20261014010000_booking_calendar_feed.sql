-- =============================================================================
-- BOOKING · Calendario del celular (D-051).
--
-- Cada profesional tiene un link secreto de calendario (iCal) para suscribirse
-- desde Google Calendar, el iPhone u Outlook: sus turnos aparecen solos.
-- * booking.calendar_feeds: el código del link (sin permisos para nadie: solo
--   por funciones). Dueño/admin lo ven y lo pueden regenerar.
-- * booking.calendar_events: solo service_role (Edge Function `calendar`).
-- =============================================================================

create table booking.calendar_feeds (
  business_id uuid not null references core.businesses (id) on delete restrict,
  staff_id    uuid not null,
  token       text not null unique check (token ~ '^[0-9a-f]{40}$'),
  created_at  timestamptz not null default now(),
  primary key (business_id, staff_id),
  foreign key (business_id, staff_id) references booking.staff (business_id, id) on delete cascade
);
alter table booking.calendar_feeds enable row level security;

-- Devuelve el código del link del profesional (lo crea si no existe). Dueño/admin.
create function booking.calendar_token(p_staff_id uuid, p_rotate boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_token text;
begin
  select business_id into v_business from booking.staff where id = p_staff_id;
  if v_business is null then
    raise exception 'staff not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_business, array['owner', 'admin']);
  if p_rotate then
    delete from booking.calendar_feeds where business_id = v_business and staff_id = p_staff_id;
  end if;
  select token into v_token from booking.calendar_feeds
   where business_id = v_business and staff_id = p_staff_id;
  if v_token is null then
    v_token := substr(replace(gen_random_uuid()::text, '-', '') ||
                      replace(gen_random_uuid()::text, '-', ''), 1, 40);
    insert into booking.calendar_feeds (business_id, staff_id, token)
    values (v_business, p_staff_id, v_token);
  end if;
  return v_token;
end;
$$;

-- Turnos del profesional (30 días atrás, 120 adelante) para el archivo iCal.
create function booking.calendar_events(p_token text)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status text,
               service_name text, customer_name text, customer_phone text,
               staff_name text, business_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.starts_at, a.ends_at, a.status, sv.name, c.name, c.phone, st.name, b.name
    from booking.calendar_feeds f
    join booking.staff st on st.id = f.staff_id
    join core.businesses b on b.id = f.business_id
    join booking.appointments a on a.business_id = f.business_id and a.staff_id = f.staff_id
    join booking.services sv on sv.id = a.service_id
    join core.customers c on c.id = a.customer_id
   where f.token = coalesce(p_token, '')
     and core.has_module(f.business_id, 'booking')
     and a.status in ('booked', 'attended')
     and a.starts_at between now() - interval '30 days' and now() + interval '120 days'
   order by a.starts_at
$$;

revoke execute on function booking.calendar_token(uuid, boolean),
  booking.calendar_events(text) from public, anon, authenticated;
grant execute on function booking.calendar_token(uuid, boolean) to authenticated;
grant execute on function booking.calendar_events(text) to service_role;
revoke execute on all functions in schema core from public, anon;
