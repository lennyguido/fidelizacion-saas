-- Aislamiento entre negocios: el negocio A nunca ve ni modifica datos del B.
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Preparación (como postgres) --------------------------------------------------
select tests.create_user('owner_a@test.local') as owner_a \gset
select tests.create_user('staff_a@test.local') as staff_a \gset
select tests.create_user('owner_b@test.local') as owner_b \gset
select tests.create_user('stranger@test.local') as stranger \gset
select tests.create_business('biz-a', :'owner_a') as biz_a \gset
select tests.create_business('biz-b', :'owner_b') as biz_b \gset
select tests.add_member(:'biz_a', :'staff_a', 'staff');
select tests.create_customer(:'biz_a', 'Cliente A') as cust_a \gset
select tests.create_customer(:'biz_b', 'Cliente B') as cust_b \gset
select tests.backfill_visits(:'cust_b', array[3, 10], 500000);
select id as loc_b from core.locations where business_id = :'biz_b' \gset

-- Dueño de A ------------------------------------------------------------------
select tests.authenticate_as(:'owner_a');

select results_eq($$ select slug from core.businesses $$, $$ values ('biz-a') $$,
  'owner A sees only business A');
select results_eq($$ select name from core.customers $$, $$ values ('Cliente A') $$,
  'owner A sees only customers of A');
select is_empty(format('select 1 from core.visits where business_id = %L', :'biz_b'),
  'owner A cannot see visits of B');
select is_empty(format('select 1 from core.customer_stats where business_id = %L', :'biz_b'),
  'owner A cannot see customer stats of B');
select is_empty(format('select 1 from core.customer_status_history where business_id = %L', :'biz_b'),
  'owner A cannot see status history of B');
select is_empty(format('select 1 from core.memberships where business_id = %L', :'biz_b'),
  'owner A cannot see memberships of B');
select is_empty(format('select 1 from core.locations where business_id = %L', :'biz_b'),
  'owner A cannot see locations of B');
select is_empty(format('select 1 from core.business_modules where business_id = %L', :'biz_b'),
  'owner A cannot see modules of B');
select throws_ok($$ select 1 from core.events $$, '42501', null, 'events are not readable by users');

select throws_ok(
  format($$ insert into core.customers (business_id, name) values (%L, 'intruso') $$, :'biz_b'),
  '42501', null, 'owner A cannot create customers in B');
select throws_ok(
  format($$ insert into core.locations (business_id, name) values (%L, 'intrusa') $$, :'biz_b'),
  '42501', null, 'owner A cannot create locations in B');
select throws_ok(
  format($$ select core.record_visit(%L) $$, :'biz_b'),
  '42501', null, 'owner A cannot record visits in B');
select throws_ok(
  format($$ select core.record_visit(%L, %L) $$, :'biz_a', :'loc_b'),
  'P0002', null, 'owner A cannot use a location of B');
select throws_ok(
  format($$ select core.record_visit(%L, null, %L) $$, :'biz_a', :'cust_b'),
  'P0002', null, 'owner A cannot record a visit for a customer of B');

select is_empty(
  format($$ update core.businesses set name = 'hackeado' where id = %L returning 1 $$, :'biz_b'),
  'owner A cannot update business B');
select is_empty(
  format($$ update core.customers set name = 'hackeado' where id = %L returning 1 $$, :'cust_b'),
  'owner A cannot update customers of B');

select throws_ok(
  format($$ update core.businesses set status = 'suspended' where id = %L $$, :'biz_a'),
  '42501', null, 'owner cannot change business status (column not granted)');
select throws_ok(
  format($$ insert into core.memberships (business_id, user_id, role) values (%L, %L, 'owner') $$,
         :'biz_a', :'stranger'),
  '42501', null, 'memberships cannot be inserted directly');
select throws_ok(
  format($$ insert into core.business_modules (business_id, module_id) values (%L, 'booking') $$, :'biz_a'),
  '42501', null, 'modules cannot be enabled directly');

-- Empleado de A: lee, pero no administra --------------------------------------
select tests.authenticate_as(:'staff_a');
select is_empty(
  format($$ update core.businesses set name = 'x' where id = %L returning 1 $$, :'biz_a'),
  'staff cannot update the business');
select is_empty($$ select 1 from core.audit_log $$, 'staff cannot read the audit log');

-- Usuario sin negocio ---------------------------------------------------------
select tests.authenticate_as(:'stranger');
select is_empty($$ select 1 from core.customers $$, 'a user without membership sees no customers');

-- Anónimo -----------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok($$ select 1 from core.customers $$, '42501', null, 'anon has no access to core tables');

-- Integridad: una visita no puede mezclar negocios ni siquiera como postgres ----
reset role;
select throws_ok(
  format($$ insert into core.visits (business_id, location_id, customer_id, currency, source)
            values (%L, (select id from core.locations where business_id = %L), %L, 'ARS', 'manual') $$,
         :'biz_a', :'biz_a', :'cust_b'),
  '23503', null, 'composite foreign keys reject cross-tenant references');

select * from finish();
rollback;
