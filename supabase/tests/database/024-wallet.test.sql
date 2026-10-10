-- Fidelización: tarjeta en Google Wallet / Apple Wallet (docs/WALLET.md).
-- Las tablas y funciones del wallet son solo para la Edge Function (service role).
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('libreria', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');
insert into core.customers (business_id, name, phone, email)
values (:'biz', 'Rosa María Pérez', '+5491144445555', 'rosa@mail.com') returning id as rosa \gset
insert into core.customers (business_id, name) values (:'biz2', 'Juan Gómez') returning id as juan \gset
insert into loyalty.programs (business_id) values (:'biz'), (:'biz2');
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Señalador', 2);

select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'rosa')).id as rosa_m \gset
select loyalty.issue_card(:'rosa_m') as token \gset
select tests.authenticate_as(:'other');
select (loyalty.enroll_customer(:'juan')).id as juan_m \gset
select loyalty.issue_card(:'juan_m') as token2 \gset

-- Nadie fuera de la service role ve ni usa el wallet --------------------------------
select tests.authenticate_as(:'staff');
select throws_ok($$ select * from loyalty.wallet_passes $$, '42501', null,
  'authenticated cannot read wallet_passes');
select throws_ok($$ select * from loyalty.wallet_updates $$, '42501', null,
  'authenticated cannot read wallet_updates');
select throws_ok($$ select * from loyalty.wallet_devices $$, '42501', null,
  'authenticated cannot read wallet_devices');
select throws_ok(format($$ select loyalty.wallet_issue_pass(%L, 'google') $$, :'token'), '42501', null,
  'authenticated cannot create wallet passes');
select throws_ok($$ select loyalty.wallet_claim_updates('google') $$, '42501', null,
  'authenticated cannot read the update queue');
select tests.authenticate_as_anon();
select throws_ok($$ select * from loyalty.wallet_passes $$, '42501', null,
  'anon cannot read wallet_passes');
select throws_ok($$ select * from loyalty.wallet_updates $$, '42501', null,
  'anon cannot read wallet_updates');
select throws_ok(format($$ select loyalty.wallet_issue_pass(%L, 'google') $$, :'token'), '42501', null,
  'anon cannot create wallet passes (only the Edge Function can)');

-- La Edge Function (service role) crea el pase con el link secreto ----------------
reset role;
set local role service_role;
select loyalty.wallet_issue_pass(:'token', 'google') as pass \gset
select (:'pass'::jsonb) ->> 'passId' as pass_id \gset
select is((:'pass'::jsonb) ->> 'firstName', 'Rosa', 'the pass shows only the first name');
select is((:'pass'::jsonb) ->> 'memberCode',
  (select member_code from loyalty.members where id = :'rosa_m'), 'the pass carries the member code (QR)');
select is(((:'pass'::jsonb) ->> 'pointsBalance')::int, 0, 'the pass shows the balance');
select is((:'pass'::jsonb) -> 'nextReward' ->> 'name', 'Señalador', 'the pass shows the next reward');
select ok((:'pass'::jsonb)::text !~ '(5491144445555|rosa@mail.com|Pérez)',
  'the pass never includes phone, email or last name');
select is(loyalty.wallet_issue_pass(repeat('0', 64), 'google'), null, 'a wrong card link creates no pass');
select is((loyalty.wallet_issue_pass(:'token', 'google')) ->> 'passId', :'pass_id',
  'adding the card again reuses the same pass');
select loyalty.wallet_issue_pass(:'token2', 'google') ->> 'passId' as pass2_id \gset

-- Un cambio de saldo deja el pase "para actualizar" ---------------------------------
reset role;
select tests.authenticate_as(:'staff');
select core.record_visit(:'biz', null, :'rosa', null, now() - interval '10 minutes');
reset role;
set local role service_role;
select is((select count(*)::int from loyalty.wallet_updates where pass_id = :'pass_id' and status = 'pending'), 1,
  'a balance change enqueues one pending update');
select is((select count(*)::int from loyalty.wallet_updates where pass_id = :'pass2_id'), 0,
  'another business''s pass is not touched (tenant isolation)');
select is((select business_id from loyalty.wallet_updates where pass_id = :'pass_id'), :'biz'::uuid,
  'the update belongs to the pass''s business');

reset role;
select tests.authenticate_as(:'owner');
select loyalty.adjust_points(:'rosa_m', 5, 'regalo');
reset role;
set local role service_role;
select is((select count(*)::int from loyalty.wallet_updates where pass_id = :'pass_id'), 1,
  'more changes reuse the pending update (no duplicates)');
select is((select revision from loyalty.wallet_updates where pass_id = :'pass_id'), 2,
  'each new change bumps the revision');

-- La cola: tomar, terminar, reintentar ---------------------------------------------
select loyalty.wallet_claim_updates('google') as claim \gset
select is(jsonb_array_length(:'claim'::jsonb), 1, 'claim returns only due updates of the provider');
select is(((:'claim'::jsonb) -> 0 -> 'pass' ->> 'pointsBalance')::int, 6, 'the claimed update has the latest balance');
select is(jsonb_array_length(loyalty.wallet_claim_updates('google')), 0,
  'a claimed update is not handed out twice while in flight');
select (:'claim'::jsonb) -> 0 ->> 'updateId' as update_id \gset
select is(loyalty.wallet_finish_update(:'update_id', 2, 'HTTP 500'), 'retry', 'a failure schedules a retry');
select ok((select next_attempt_at > now() and last_error = 'HTTP 500' from loyalty.wallet_updates where id = :'update_id'),
  'the retry waits and keeps the error');
select is(loyalty.wallet_finish_update(:'update_id', 1), 'requeued',
  'finishing with an old revision keeps it pending');
select is(loyalty.wallet_finish_update(:'update_id', 2), 'done', 'finishing the latest revision closes it');

-- Apple Wallet web service ----------------------------------------------------------
select encode(sha256('apple-auth-token-123456'::bytea), 'hex') as auth_hash \gset
select loyalty.wallet_issue_pass(:'token', 'apple', :'auth_hash') ->> 'objectId' as serial \gset
select is(loyalty.wallet_apple_register(:'serial', :'auth_hash', 'device-1', 'push-1'), 'created',
  'an iPhone registers with the pass token');
select is(loyalty.wallet_apple_register(:'serial', :'auth_hash', 'device-1', 'push-1'), 'exists',
  'registering again is idempotent');
select is(loyalty.wallet_apple_register(:'serial', repeat('0', 64), 'device-2', 'push-2'), 'unauthorized',
  'a wrong pass token is rejected');
select is((loyalty.wallet_apple_serials('device-1')) -> 'serialNumbers', jsonb_build_array(:'serial'::text),
  'the device lists its passes');

-- Salir del programa: el pase queda inactivo y sin nombre --------------------------
reset role;
select tests.authenticate_as(:'staff');
select loyalty.leave_program(:'rosa_m');
reset role;
set local role service_role;
select ok((loyalty.wallet_pass_data(:'pass_id')) ->> 'active' = 'false'
          and (loyalty.wallet_pass_data(:'pass_id')) ->> 'firstName' is null
          and exists (select 1 from loyalty.wallet_updates where pass_id = :'pass_id' and status = 'pending'),
  'leaving the program enqueues an update and the pass becomes inactive without the name');

select * from finish();
rollback;
