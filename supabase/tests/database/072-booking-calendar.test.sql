-- Calendario del celular (D-051).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('barbero@test.local') as staff \gset
select tests.create_business('barber-cal', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, min_notice_minutes) values (:'biz', true, 0);
insert into booking.services (business_id, name, duration_minutes) values (:'biz', 'Corte', 30) returning id as corte \gset
insert into booking.staff (business_id, name) values (:'biz', 'Juan') returning id as juan \gset
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
select :'biz', :'juan', d, '10:00', '12:00' from generate_series(0, 6) d;

select booking.calendar_token(:'juan') as tok \gset
select ok(:'tok' ~ '^[0-9a-f]{40}$', 'the owner gets the calendar link');
select is(booking.calendar_token(:'juan'), :'tok', 'the link stays the same');

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select booking.calendar_token(%L) $$, :'juan'), '42501', null,
  'staff cannot read the calendar link');

reset role;
select (((current_date + 2) + time '10:00') at time zone timezone) as t10
  from core.businesses where slug = 'barber-cal' \gset
select tests.authenticate_as_anon();
select booking.book('barber-cal', :'corte', null, :'t10',
  'Ana', '+5491177770001', true);
reset role;
set local role service_role;
select is((select count(*)::int from booking.calendar_events(:'tok')), 1, 'the feed has the appointment');
select is((select count(*)::int from booking.calendar_events('x')), 0, 'a wrong link has nothing');
reset role;

select tests.authenticate_as(:'owner');
select isnt(booking.calendar_token(:'juan', true), :'tok', 'regenerating changes the link');

select * from finish();
rollback;
