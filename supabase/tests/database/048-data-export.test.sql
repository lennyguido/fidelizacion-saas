-- Exportar datos ("Tus clientes son tuyos", D-034): solo dueño o admin, sin datos
-- de otros negocios, rango de fechas en la hora del negocio y registro de quién exportó.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('kiosco-export', :'owner') as biz \gset
select tests.create_business('otro-export', :'other') as other_biz \gset
select tests.add_member(:'biz', :'admin', 'admin');
select tests.add_member(:'biz', :'staff', 'staff');

insert into core.customers (business_id, name, phone, tags, birth_day, birth_month)
values (:'biz', 'Ana', '+5491180000001', '{vip,mañana}', 3, 5);
select tests.create_customer(:'biz', 'Beto') as beto \gset
select tests.create_customer(:'other_biz', 'Ajeno') as ajeno \gset
select id as ana from core.customers where business_id = :'biz' and name = 'Ana' \gset
select tests.backfill_visits(:'ana', array[1, 2, 400], 150000);
select tests.backfill_visits(:'ajeno', array[1]);
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
values (:'biz', :'ana', 'whatsapp', 'marketing', true, 'counter');

insert into loyalty.members (business_id, customer_id) values (:'biz', :'ana') returning id as member \gset
insert into loyalty.ledger (business_id, member_id, delta, reason, note)
values (:'biz', :'member', 5, 'adjustment', 'Bienvenida');

-- Clientes ----------------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select is(jsonb_array_length(core.export_customers(:'biz')), 2, 'the owner exports all her customers');
select results_eq(
  format($$ select e ->> 'phone', e ->> 'tags', (e ->> 'birth_day')::int, (e ->> 'visit_count')::int,
                   (e ->> 'total_spend_minor')::bigint, (e ->> 'whatsapp_marketing')::boolean
              from jsonb_array_elements(core.export_customers(%L)) e where e ->> 'name' = 'Ana' $$, :'biz'),
  $$ values ('+5491180000001'::text, 'vip, mañana'::text, 3, 3, 450000::bigint, true) $$,
  'each customer row has phone, tags, birthday, visits, spend and consent');
select ok(
  not exists (select 1 from jsonb_array_elements(core.export_customers(:'biz')) e
               where e ->> 'name' = 'Ajeno'),
  'customers of another business are never exported');

select tests.authenticate_as(:'admin');
select is(jsonb_array_length(core.export_customers(:'biz')), 2, 'an admin can export too');

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.export_customers(%L) $$, :'biz'),
  '42501', null, 'staff cannot export customers');
select throws_ok(format($$ select core.export_visits(%L, current_date - 30, current_date) $$, :'biz'),
  '42501', null, 'staff cannot export visits');
select throws_ok(format($$ select loyalty.export_ledger(%L, current_date - 30, current_date) $$, :'biz'),
  '42501', null, 'staff cannot export the points ledger');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select core.export_customers(%L) $$, :'biz'),
  '42501', null, 'another business cannot export my customers');

select tests.authenticate_as_anon();
select throws_ok(format($$ select core.export_customers(%L) $$, :'biz'),
  '42501', null, 'anon cannot export');

-- Visitas -----------------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select is(
  jsonb_array_length(core.export_visits(:'biz', current_date - 30, current_date)), 2,
  'visits are filtered by date range (the one from 400 days ago is left out)');
select results_eq(
  format($$ select e ->> 'customer_name', e ->> 'location', (e ->> 'amount_minor')::bigint, e ->> 'source',
                   (e ->> 'voided')::boolean
              from jsonb_array_elements(core.export_visits(%L, current_date - 30, current_date)) e
             limit 1 $$, :'biz'),
  $$ values ('Ana'::text, 'Principal'::text, 150000::bigint, 'import'::text, false) $$,
  'each visit row has customer, location, amount, source and voided flag');
select throws_ok(format($$ select core.export_visits(%L, current_date, current_date - 1) $$, :'biz'),
  '22023', null, 'a range that ends before it starts is rejected');
select throws_ok(format($$ select core.export_visits(%L, current_date - 400, current_date) $$, :'biz'),
  '22023', null, 'a range longer than a year is rejected');

-- Movimientos de puntos ---------------------------------------------------------------------
select results_eq(
  format($$ select e ->> 'customer_name', (e ->> 'delta')::bigint, e ->> 'reason', e ->> 'note'
              from jsonb_array_elements(loyalty.export_ledger(%L, current_date - 1, current_date)) e $$,
         :'biz'),
  $$ values ('Ana'::text, 5::bigint, 'adjustment'::text, 'Bienvenida'::text) $$,
  'the owner exports the points ledger');

reset role;
update core.business_modules set enabled = false where business_id = :'biz' and module_id = 'loyalty';
select tests.authenticate_as(:'owner');
select throws_ok(format($$ select loyalty.export_ledger(%L, current_date - 1, current_date) $$, :'biz'),
  '42501', null, 'the ledger export needs the loyalty module');

-- Registro ----------------------------------------------------------------------------------
reset role;
select results_eq(
  format($$ select payload ->> 'kind', count(*)::int from core.events
             where business_id = %L and type = 'data.exported'
               and payload ->> 'actor_id' in (%L, %L)
             group by 1 order by 1 $$, :'biz', :'owner', :'admin'),
  $$ values ('customers'::text, 4), ('loyalty_ledger'::text, 1), ('visits'::text, 2) $$,
  'every export is recorded with who did it');
select ok(
  (select (payload ->> 'rows')::int = 2 from core.events
    where business_id = :'biz' and type = 'data.exported' and payload ->> 'kind' = 'visits'
    order by id desc limit 1),
  'the record says how many rows were exported');
select is(
  (select count(*)::int from core.events where business_id = :'other_biz' and type = 'data.exported'),
  0, 'failed attempts do not leave records in other businesses');

select * from finish();
rollback;
