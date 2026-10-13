-- Turnos (D-049): página pública, horarios libres, reserva sin cuenta, sin
-- superposición, cancelar con el link, agenda del panel, "asistió" registra visita.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('barbero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('barberia-sol', :'owner') as biz \gset
select tests.create_business('otra-barberia', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
update core.businesses set timezone = 'America/Argentina/Buenos_Aires' where id = :'biz';

-- Configuración (dueño) ------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ insert into booking.services (business_id, name, duration_minutes)
                          values (%L, 'Corte', 30) $$, :'biz'),
  '42501', null, 'staff cannot configure services');

select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, min_notice_minutes) values (:'biz', true, 0);
insert into booking.services (business_id, name, duration_minutes, price_minor)
values (:'biz', 'Corte', 30, 800000) returning id as corte \gset
insert into booking.staff (business_id, name) values (:'biz', 'Juan') returning id as juan \gset
-- Todos los días de 10 a 12.
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
select :'biz', :'juan', d, '10:00', '12:00' from generate_series(0, 6) d;
select (current_date + 2) as day \gset

-- Público ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select is(booking.get_public_page('barberia-sol') -> 'services' -> 0 ->> 'name', 'Corte',
  'the public page lists the services');
select is(booking.get_public_page('otra-barberia'), null, 'a business without booking enabled has no page');
select is((select count(*)::int from booking.available_slots('barberia-sol', :'corte', null, :'day')), 7,
  '10:00 to 12:00 in 15-minute steps for a 30-minute service = 7 slots');
select ((:'day'::date + time '10:00') at time zone 'America/Argentina/Buenos_Aires') as ten \gset
select booking.book('barberia-sol', :'corte', null, :'ten', 'Ana Gómez', '+5491155550001', true) as res \gset
select is(:'res'::jsonb ->> 'status', 'booked', 'anyone can book without an account');
select :'res'::jsonb ->> 'token' as token \gset
select is(booking.book('barberia-sol', :'corte', null, :'ten', 'Beto', '+5491155550002', true) ->> 'status',
  'taken', 'the same slot cannot be booked twice');
select is((select count(*)::int from booking.available_slots('barberia-sol', :'corte', null, :'day')), 5,
  'a 30-minute booking at 10:00 removes the 10:00 and 10:15 starts');
select is(booking.book('barberia-sol', :'corte', null, :'ten', 'Ana', '+5491155550001', false) ->> 'status',
  'terms_required', 'terms must be accepted');
select is(booking.book('barberia-sol', :'corte', null, :'ten' , 'Ana', '123', true) ->> 'status',
  'invalid_phone', 'the phone is validated');
select is(booking.get_appointment(:'token') ->> 'serviceName', 'Corte', 'the secret link shows the appointment');
select is(booking.get_appointment('x'), null, 'a wrong link shows nothing');
select throws_ok($$ select * from booking.appointments $$, '42501', null, 'anon cannot read appointments');

-- El cliente quedó en el núcleo.
reset role;
select is((select source from core.customers where business_id = :'biz' and phone = '+5491155550001'),
  'booking', 'the customer is created in the core with source booking');

-- Panel -----------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select is((select count(*)::int from booking.agenda(:'biz', :'day', :'day')), 1,
  'staff sees the agenda');
select ((:'day'::date + time '11:00') at time zone 'America/Argentina/Buenos_Aires') as eleven \gset
select is(booking.book_from_panel(:'biz', :'corte', :'juan', :'eleven', 'Carla', '+5491155550003') ->> 'status',
  'booked', 'staff can book from the panel (phone call)');
select id as appt from booking.agenda(:'biz', :'day', :'day') where customer_name = 'Ana Gómez' \gset
select is(booking.set_status(:'appt', 'attended'), 'attended', 'attended');
reset role;
select is((select source || ':' || amount_minor from core.visits where customer_id =
           (select customer_id from booking.appointments where id = :'appt')),
  'booking:800000', 'attended records a core visit with the price');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from booking.agenda(%L, %L, %L) $$, :'biz', :'day', :'day'),
  '42501', null, 'another business cannot see the agenda');

-- Cancelar con el link -------------------------------------------------------------
select tests.authenticate_as_anon();
select booking.book('barberia-sol', :'corte', null,
  ((:'day'::date + time '11:30') at time zone 'America/Argentina/Buenos_Aires'),
  'Dani', '+5491155550004', true) ->> 'token' as token2 \gset
select is(booking.cancel_by_customer(:'token2'), 'cancelled', 'the customer cancels with the link');
select is(booking.cancel_by_customer(:'token2'), 'not_booked', 'it cannot be cancelled twice');

select * from finish();
rollback;
