-- "Mandámelo por mail" y bandeja de mails del núcleo (D-055).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_business('barber-mail', :'owner') as biz \gset
select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, min_notice_minutes) values (:'biz', true, 0);
insert into booking.services (business_id, name, duration_minutes) values (:'biz', 'Corte', 30) returning id as corte \gset
insert into booking.staff (business_id, name) values (:'biz', 'Juan') returning id as juan \gset
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
select :'biz', :'juan', d, '10:00', '12:00' from generate_series(0, 6) d;
reset role;
select (((current_date + 2) + time '10:00') at time zone timezone) as t10
  from core.businesses where slug = 'barber-mail' \gset

select tests.authenticate_as_anon();
select booking.book('barber-mail', :'corte', null, :'t10', 'Ana', '+5491199990001', true) ->> 'token' as tok \gset

select is(booking.send_by_email(:'tok', 'no-es-mail'), 'invalid_email', 'rejects a bad email');
select is(booking.send_by_email('x', 'ana@mail.com'), 'not_found', 'needs the secret link');
select is(booking.send_by_email(:'tok', ' Ana@Mail.com '), 'queued', 'queues the email');
select throws_ok($$ select * from core.email_outbox $$, '42501', null, 'anon cannot read the outbox');
select is((booking.get_appointment(:'tok') ->> 'color'), null, 'appointment view has the brand fields');

reset role;
select is((select email from core.customers where phone = '+5491199990001'), 'ana@mail.com',
  'the email is saved in the customer profile');

set local role service_role;
select is((select count(*)::int from core.email_batch(10)), 1, 'the sender takes the queued email');
select is((select count(*)::int from core.email_batch(10)), 0, 'and does not take it twice');
select core.email_result((select id from core.email_outbox limit 1), true);
reset role;
select is((select payload from core.email_outbox limit 1), null,
  'after sending, the secret link is erased');

select tests.authenticate_as_anon();
select booking.send_by_email(:'tok', 'ana@mail.com');
select booking.send_by_email(:'tok', 'ana@mail.com');
select is(booking.send_by_email(:'tok', 'ana@mail.com'), 'limit', 'at most 3 emails per appointment');

select * from finish();
rollback;
