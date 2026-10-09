-- Borrado de datos personales de un cliente (derecho de supresión).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('staff@test.local') as staff \gset
select tests.create_business('libreria', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

insert into core.customers (business_id, name, phone, email, notes)
values (:'biz', 'Rosa Pérez', '+5491144445555', 'rosa@mail.com', 'Le gustan las novelas')
returning id as rosa \gset
select tests.backfill_visits(:'rosa', array[3, 10, 17], 400000);

-- Un cambio previo deja datos personales en la auditoría.
select tests.authenticate_as(:'owner');
update core.customers set phone = '+5491166667777' where id = :'rosa';

select tests.authenticate_as(:'staff');
select throws_ok(
  format($$ select core.anonymize_customer(%L) $$, :'rosa'),
  '42501', null, 'staff cannot erase customer data');

select tests.authenticate_as(:'owner');
select lives_ok(format($$ select core.anonymize_customer(%L) $$, :'rosa'), 'the owner can erase customer data');

reset role;
select results_eq(
  format($$ select name, phone, email, notes, status from core.customers where id = %L $$, :'rosa'),
  $$ values ('Cliente anónimo', null::text, null::text, null::text, 'archived') $$,
  'personal data is replaced and the customer is archived');
select is(
  (select count(*)::int from core.visits where customer_id = :'rosa'), 3,
  'visits are kept so business statistics stay correct');
select is(
  (select visit_count from core.customer_stats where customer_id = :'rosa'), 3,
  'stats are kept');
select is_empty(
  format($$ select 1 from core.audit_log where record_id = %L
            and (old_data::text like '%%+549114444%%' or new_data::text like '%%+549116666%%'
                 or old_data::text like '%%Rosa%%' or new_data::text like '%%Rosa%%') $$, :'rosa'),
  'the audit log no longer contains the personal data');

select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ select core.anonymize_customer(%L) $$, :'rosa'),
  '22023', null, 'it cannot be done twice');
select is_empty(
  format($$ update core.customers set name = 'Rosa' where id = %L returning 1 $$, :'rosa'),
  'an anonymized customer cannot be edited again');
select throws_ok(
  format($$ select core.record_visit(%L, null, %L) $$, :'biz', :'rosa'),
  'P0002', null, 'no new visits can be recorded for an anonymized customer');

select * from finish();
rollback;
