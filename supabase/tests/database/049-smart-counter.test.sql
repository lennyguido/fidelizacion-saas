-- Mostrador inteligente (D-038): ficha rápida del cliente, ranking del equipo de la
-- semana (el empleado no ve los números de los demás) y top 10 de clientes.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('kiosco-smart', :'owner') as biz \gset
select tests.create_business('otro-smart', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

insert into core.customers (business_id, name, notes, created_at)
values (:'biz', 'Ana Habitual', 'Toma el café sin azúcar y pide la mesa de la ventana siempre que viene', now() - interval '2 years');
select id as ana from core.customers where name = 'Ana Habitual' \gset
select tests.create_customer(:'biz', 'Beto Nuevo') as beto \gset
select tests.backfill_visits(:'ana', array[2, 11, 20, 29, 38], 150000);

-- Ficha rápida ------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select core.customer_snapshot(:'ana') as snap \gset
select is((:'snap'::jsonb ->> 'nextVisitNumber')::int, 6, 'the snapshot says which visit this is');
select is((:'snap'::jsonb ->> 'medianIntervalDays')::int, 9, '...how often the customer comes');
select ok((:'snap'::jsonb ->> 'customerSince')::timestamptz < now() - interval '700 days',
  '...and since when');
select is(char_length(:'snap'::jsonb ->> 'note'), 80, 'the note is cut to 80 characters');
select is(:'snap'::jsonb -> 'totalSpendMinor', 'null'::jsonb, 'staff does not see the money');

select tests.authenticate_as(:'owner');
select is((core.customer_snapshot(:'ana') ->> 'totalSpendMinor')::bigint, 750000::bigint,
  'the owner sees what the customer spent');
select is(core.customer_snapshot(:'beto') -> 'totalSpendMinor', 'null'::jsonb,
  'without amounts there is no money value (nothing is invented)');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select core.customer_snapshot(%L) $$, :'ana'),
  '42501', null, 'another business cannot see my customers');

-- Ranking del equipo -------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select core.record_visit(:'biz', null, :'beto', null, now());
select core.record_visit(:'biz', null, null, null, now());
select tests.authenticate_as(:'owner');
select core.record_visit(:'biz', null, null, null, now());

select results_eq(
  format($$ select email, visits from core.team_week_stats(%L) $$, :'biz'),
  $$ values ('cajero@test.local'::text, 2), ('duena@test.local'::text, 1) $$,
  'the owner sees the team ranking with numbers');

select tests.authenticate_as(:'staff');
select results_eq(
  format($$ select email, visits, is_me from core.team_week_stats(%L) $$, :'biz'),
  $$ values ('cajero@test.local'::text, 2, true), ('duena@test.local'::text, null::int, false) $$,
  'staff sees the order but only their own numbers');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from core.team_week_stats(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my team');

-- Top 10 ------------------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select name, visits, spend_minor from core.top_customers(%L) $$, :'biz'),
  $$ values ('Ana Habitual'::text, 5, 750000::bigint), ('Beto Nuevo'::text, 1, null::bigint) $$,
  'top customers by visits in 90 days, with spend only when there are amounts');

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select * from core.top_customers(%L) $$, :'biz'),
  '42501', null, 'staff cannot see the top customers');
select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from core.top_customers(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my top customers');

select * from finish();
rollback;
