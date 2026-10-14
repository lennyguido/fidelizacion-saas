-- Llenar huecos (D-053).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('otro@test.local') as stranger \gset
select tests.create_business('barber-gap', :'owner') as biz \gset
select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, min_notice_minutes) values (:'biz', true, 0);
insert into booking.services (business_id, name, duration_minutes) values (:'biz', 'Corte', 30) returning id as corte \gset
insert into booking.staff (business_id, name) values (:'biz', 'Juan') returning id as juan \gset
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
select :'biz', :'juan', d, '10:00', '12:00' from generate_series(0, 6) d;

reset role;
select (((current_date + 2) + time '10:00') at time zone timezone) as t10,
       (((current_date + 2) + time '10:30') at time zone timezone) as t1030,
       (((current_date + 2) + time '11:00') at time zone timezone) as t11,
       (((current_date + 3) + time '10:00') at time zone timezone) as later
  from core.businesses where slug = 'barber-gap' \gset

select tests.authenticate_as_anon();
select booking.book('barber-gap', :'corte', null, :'t10', 'Ana', '+5491188880001', true, true);
select booking.book('barber-gap', :'corte', null, :'t1030', 'Beto', '+5491188880002', true);
select booking.book('barber-gap', :'corte', null, :'t11', 'Carla', '+5491188880003', true, true);
reset role;

select is((select count(*)::int from core.customer_consents cs
             join core.customers c on c.id = cs.customer_id
            where c.name = 'Ana' and cs.granted and cs.channel = 'whatsapp'), 1,
  'booking with the promos box records WhatsApp consent');
select is((select count(*)::int from core.customer_consents cs
             join core.customers c on c.id = cs.customer_id where c.name = 'Beto'), 0,
  'without the box nothing is recorded');

-- Ana y Beto vinieron hace 40 días; Carla hace 5.
update booking.appointments a set status = 'attended',
       starts_at = now() - interval '40 days', ends_at = now() - interval '40 days' + interval '30 minutes'
  from core.customers c where c.id = a.customer_id and c.name = 'Ana';
update booking.appointments a set status = 'attended',
       starts_at = now() - interval '41 days', ends_at = now() - interval '41 days' + interval '30 minutes'
  from core.customers c where c.id = a.customer_id and c.name = 'Beto';
update booking.appointments a set status = 'attended',
       starts_at = now() - interval '5 days', ends_at = now() - interval '5 days' + interval '30 minutes'
  from core.customers c where c.id = a.customer_id and c.name = 'Carla';

select tests.authenticate_as(:'owner');
select is((select array_agg(name) from booking.lapsed_clients(:'biz', 30)), array['Ana'],
  'only clients away 30+ days who accepted promos');
select is((select days_away from booking.lapsed_clients(:'biz', 30)), 40, 'days away');

select ok((select count(*) from booking.gap_slots(:'biz', current_date + 2)) > 0,
  'free slots of the day');
select is((select count(*)::int from booking.gap_slots(:'biz', current_date + 2)),
          (select count(*)::int from booking.available_slots('barber-gap', :'corte', null, current_date + 2)),
  'same slots the public page offers');

-- Si Ana ya sacó otro turno, no aparece.
reset role;
select tests.authenticate_as_anon();
select booking.book('barber-gap', :'corte', null, :'later', 'Ana', '+5491188880001', true);
select tests.authenticate_as(:'owner');
select is((select count(*)::int from booking.lapsed_clients(:'biz', 30)), 0,
  'clients with an upcoming appointment are not listed');

select tests.authenticate_as(:'stranger');
select throws_ok(format($$ select * from booking.lapsed_clients(%L) $$, :'biz'), '42501', null,
  'other businesses cannot see the list');

select * from finish();
rollback;
