-- Turnos (D-050): reprogramar con el link, mover desde el panel, clientes e historial.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('nails-sol', :'owner') as biz \gset
select tests.create_business('otra', :'other') as other_biz \gset
update core.businesses set timezone = 'America/Argentina/Buenos_Aires' where id = :'biz';

select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, min_notice_minutes, cancel_notice_minutes)
values (:'biz', true, 0, 60);
insert into booking.services (business_id, name, duration_minutes, price_minor)
values (:'biz', 'Manicura', 60, 1000000) returning id as mani \gset
insert into booking.staff (business_id, name) values (:'biz', 'Lu') returning id as lu \gset
insert into booking.staff (business_id, name) values (:'biz', 'Sofi') returning id as sofi \gset
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
select :'biz', s, d, '10:00', '14:00' from generate_series(0, 6) d, unnest(array[:'lu'::uuid, :'sofi'::uuid]) s;
select (current_date + 3) as day \gset
select ((:'day'::date + time '10:00') at time zone 'America/Argentina/Buenos_Aires') as t10 \gset
select ((:'day'::date + time '10:30') at time zone 'America/Argentina/Buenos_Aires') as t1030 \gset
select ((:'day'::date + time '12:00') at time zone 'America/Argentina/Buenos_Aires') as t12 \gset

select tests.authenticate_as_anon();
select booking.book('nails-sol', :'mani', :'lu', :'t10', 'Rocío', '+5491166660001', true) ->> 'token' as tok \gset

-- Reprogramar: puede moverse a un horario que se pisa con el suyo (se libera primero).
select is(booking.reschedule(:'tok', :'t1030'), 'rescheduled', 'the customer reschedules with the link');
select is(booking.get_appointment(:'tok') ->> 'staffId', :'lu', 'keeps the same professional when free');
select is(booking.reschedule('x', :'t12'), 'not_found', 'a wrong link cannot reschedule');

-- Otro cliente ocupa las 12 con Lu: reprogramar a las 12 va con Sofi.
select booking.book('nails-sol', :'mani', :'lu', :'t12', 'Ana', '+5491166660002', true) ->> 'token' as tok2 \gset
select is(booking.reschedule(:'tok', :'t12'), 'rescheduled', 'reschedules to a time another professional has free');
select is(booking.get_appointment(:'tok') ->> 'staffId', :'sofi', 'moves to the free professional');

-- Panel: mover encima de otro turno no se puede.
select tests.authenticate_as(:'owner');
select id as appt from booking.agenda(:'biz', :'day', :'day') where customer_name = 'Rocío' \gset
select is(booking.move_appointment(:'appt', :'lu', :'t12'), 'taken', 'cannot move over another appointment');
select is(booking.move_appointment(:'appt', :'lu', :'t10'), 'moved', 'moves to a free time');

-- Clientes e historial.
select booking.set_status(:'appt', 'attended');
select results_eq(
  format($$ select name, bookings::int, attended::int, spent_minor from booking.clients(%L) where name = 'Rocío' $$, :'biz'),
  $$ values ('Rocío'::text, 1, 1, 1000000::bigint) $$, 'client summary with visits and money');
select is((select count(*)::int from booking.client_history(:'biz',
           (select customer_id from booking.clients(:'biz', 'Rocío')))), 1, 'client history');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from booking.clients(%L) $$, :'biz'), '42501', null,
  'another business cannot see the clients');

select * from finish();
rollback;
