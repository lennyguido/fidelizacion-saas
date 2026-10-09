-- Archivar/reactivar clientes es exclusivo de owner/admin (ni siquiera por UPDATE directo).
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('staff@test.local') as staff \gset
select tests.create_user('owner_b@test.local') as owner_b \gset
select tests.create_business('verduleria', :'owner') as biz \gset
select tests.create_business('verduleria-b', :'owner_b') as biz_b \gset
select tests.add_member(:'biz', :'admin', 'admin');
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Marta') as marta \gset

-- Empleado ---------------------------------------------------------------------
select tests.authenticate_as(:'staff');

select throws_ok(
  format($$ update core.customers set status = 'archived' where id = %L $$, :'marta'),
  '42501', null, 'staff cannot archive with a direct UPDATE');
select throws_ok(
  format($$ select core.set_customer_status(%L, 'archived') $$, :'marta'),
  '42501', null, 'staff cannot archive through the function');
select lives_ok(
  format($$ update core.customers set notes = 'Prefiere pagar con QR' where id = %L $$, :'marta'),
  'staff can still edit customer data');

-- Admin y owner ----------------------------------------------------------------
select tests.authenticate_as(:'admin');
select is(
  (core.set_customer_status(:'marta', 'archived')).status, 'archived',
  'admin can archive');

select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ update core.customers set status = 'active' where id = %L $$, :'marta'),
  '42501', null, 'not even the owner can change status with a direct UPDATE');
select is(
  (core.set_customer_status(:'marta', 'active')).status, 'active',
  'owner can reactivate');
select throws_ok(
  format($$ select core.set_customer_status(%L, 'deleted') $$, :'marta'),
  '22023', null, 'only active/archived are valid');

-- Otro negocio -----------------------------------------------------------------
select tests.authenticate_as(:'owner_b');
select throws_ok(
  format($$ select core.set_customer_status(%L, 'archived') $$, :'marta'),
  '42501', null, 'an owner of another business cannot archive');

-- Auditoría --------------------------------------------------------------------
reset role;
select is(
  (select count(*)::int from core.audit_log
    where table_name = 'core.customers' and record_id = :'marta' and new_data ? 'status'), 2,
  'both status changes are audited');
select is(
  (select actor_id from core.audit_log
    where table_name = 'core.customers' and record_id = :'marta' and new_data ->> 'status' = 'archived'),
  :'admin'::uuid,
  'the audit log records who archived');

select * from finish();
rollback;
