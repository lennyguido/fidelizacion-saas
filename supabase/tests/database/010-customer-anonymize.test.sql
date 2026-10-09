-- Borrado de datos personales de un cliente (derecho de supresión).
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('staff@test.local') as staff \gset
select tests.create_business('libreria', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

insert into core.customers (business_id, name, phone, email, notes)
values (:'biz', 'Rosa Pérez', '+5491144445555', 'rosa@mail.com', 'Le gustan las novelas')
returning id as rosa \gset
select tests.backfill_visits(:'rosa', array[3, 10, 17], 400000);

-- Texto libre con datos personales en las visitas (nota y motivo de anulación).
select id as v_note from core.visits where customer_id = :'rosa' order by occurred_at desc limit 1 \gset
select id as v_void from core.visits where customer_id = :'rosa' order by occurred_at limit 1 \gset
update core.visits set notes = 'Rosa trae a su nieta' where id = :'v_note';
update core.visits set voided_at = now(), void_reason = 'Rosa pidió anular' where id = :'v_void';
select core.emit_event(:'biz', 'visit.voided',
  jsonb_build_object('visit_id', :'v_void', 'customer_id', :'rosa', 'reason', 'Rosa pidió anular'));

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

select results_eq(
  format($$ select notes, void_reason from core.visits where id in (%L, %L) order by occurred_at $$, :'v_void', :'v_note'),
  $$ values (null::text, '(dato borrado)'::text), (null::text, null::text) $$,
  'free text in visits is erased (void reason replaced)');
select is_empty(
  $$ select 1 from core.audit_log where table_name = 'core.visits'
      and (old_data::text like '%Rosa%' or new_data::text like '%Rosa%') $$,
  'the visits audit no longer contains the free text');
select is_empty(
  $$ select 1 from core.events where payload::text like '%Rosa%' $$,
  'events no longer contain the void reason');

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
