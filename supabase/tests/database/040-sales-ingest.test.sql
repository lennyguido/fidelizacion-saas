-- Ventas desde la caja (D-033): claves por negocio (solo hash), deduplicación por
-- comprobante, identificación por celular o código de socio, ventas sin
-- identificar, claves revocadas, roles, aislamiento y simulador.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('almacen', :'owner') as biz \gset
select tests.create_business('otro-almacen', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

insert into core.customers (business_id, name, phone)
values (:'biz', 'Ana', '+5491190000001'), (:'other_biz', 'Ana de otro', '+5491190000002');
select id as ana from core.customers where business_id = :'biz' and name = 'Ana' \gset
select id as other_ana from core.customers where business_id = :'other_biz' \gset

-- Claves ----------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.create_integration_key(%L, 'Caja') $$, :'biz'),
  '42501', null, 'staff cannot create keys');

select tests.authenticate_as(:'owner');
select core.create_integration_key(:'biz', 'Caja principal') ->> 'key' as api_key \gset
select ok(:'api_key' ~ '^lk_[0-9a-f]{40}$', 'the owner gets a key once');
select results_eq(
  format($$ select name, key_prefix from core.integration_keys where business_id = %L $$, :'biz'),
  format($$ values ('Caja principal'::text, %L::text) $$, left(:'api_key', 9)),
  'the panel sees the name and prefix of the key');
select throws_ok('select key_hash from core.integration_keys',
  '42501', null, 'nobody can read the key hash from the panel');

select tests.authenticate_as(:'other');
select is_empty(format($$ select 1 from core.integration_keys where business_id = %L $$, :'biz'),
  'another business cannot see my keys');

reset role;
select encode(extensions.digest(:'api_key', 'sha256'), 'hex') as key_hash \gset
select ok((select key_hash = :'key_hash' from core.integration_keys where business_id = :'biz'),
  'only the hash of the key is stored');

-- Ventas (como la Edge Function, con la service role) ----------------------------------
select is(core.ingest_sale(:'key_hash', 'FAC-0001', 850000, null, '+5491190000001') ->> 'status',
  'created', 'a sale with a known phone is recorded');
select results_eq(
  $$ select customer_id, amount_minor, source from core.visits where source_ref = 'FAC-0001' $$,
  format($$ values (%L::uuid, 850000::bigint, 'pos'::text) $$, :'ana'),
  'it becomes an identified visit of that customer, from the cash register');
select is(core.ingest_sale(:'key_hash', 'FAC-0001', 850000, null, '+5491190000001') ->> 'status',
  'duplicate', 'the same receipt again is not duplicated');
select is((select count(*)::int from core.visits where source_ref = 'FAC-0001'), 1,
  'still one visit for that receipt');

select is(core.ingest_sale(:'key_hash', 'FAC-0002', 120000) ->> 'identified', 'false',
  'a sale without a known customer still counts, unidentified');
select ok((select customer_id is null from core.visits where source_ref = 'FAC-0002'),
  'the unidentified visit has no customer');

select is(core.ingest_sale(:'key_hash', 'FAC-0003', 1000, null, null, :'other_ana') ->> 'identified', 'false',
  'a customer of another business is never matched');
select is(core.ingest_sale(:'key_hash', '', 1000) ->> 'status', 'invalid', 'a receipt is required');
select is(core.ingest_sale(repeat('0', 64), 'FAC-0004', 1000) ->> 'status', 'unauthorized',
  'an unknown key is rejected');

-- Revocar ---------------------------------------------------------------------------
select id as key_id from core.integration_keys where business_id = :'biz' \gset
select tests.authenticate_as(:'owner');
select core.revoke_integration_key(:'key_id');
reset role;
select is(core.ingest_sale(:'key_hash', 'FAC-0005', 1000) ->> 'status', 'unauthorized',
  'a revoked key stops working');

-- Simulador ---------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.simulate_sale(%L, 1000) $$, :'biz'),
  '42501', null, 'staff cannot use the simulator');
select tests.authenticate_as(:'owner');
select is(core.simulate_sale(:'biz', 500000, '+5491190000001') ->> 'identified', 'true',
  'the owner simulates a sale and it finds the customer by phone');

select * from finish();
rollback;
