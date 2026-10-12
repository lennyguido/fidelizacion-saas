-- Canje desde el celular (D-037): pedido con código que vence en 5 minutos, uno
-- vivo por tarjeta, el cajero lo encuentra y confirma (idempotente), recién ahí
-- se descuenta; aislamiento entre negocios y límites.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('cafe-celu', :'owner') as biz \gset
select tests.create_business('otro-celu', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Rita Canje') as rita \gset
insert into loyalty.programs (business_id, points_per_visit) values (:'biz', 1);
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Café', 5) returning id as cafe \gset
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Torta', 50) returning id as torta \gset

select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'rita')).id as rita_m \gset
select loyalty.issue_card(:'rita_m') as token \gset
reset role;
select loyalty.post_movement(m, 8, 'adjustment', null, null, 'Saldo inicial')
  from loyalty.members m where m.id = :'rita_m';

-- Pedido desde el celular -------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(format($$ select loyalty.request_redemption(%L, %L) $$, :'token', :'torta'),
  '22023', 'insufficient_points', 'cannot request a reward without enough points');
select throws_ok(format($$ select loyalty.request_redemption(%L, %L) $$, repeat('0', 64), :'cafe'),
  'P0002', null, 'an unknown card cannot request');
select loyalty.request_redemption(:'token', :'cafe') as req1 \gset
select ok((:'req1'::jsonb ->> 'code') ~ '^[A-Z2-9]{6}$', 'the customer gets a 6-character code');
select ok((:'req1'::jsonb ->> 'expiresAt')::timestamptz between now() + interval '4 minutes' and now() + interval '6 minutes',
  'the code expires in 5 minutes');
select is((select points_balance from loyalty.members where id = :'rita_m'), 8::bigint,
  'asking does not take points yet');
select is(loyalty.get_redemption_request(:'token', (:'req1'::jsonb ->> 'requestId')::uuid) ->> 'status',
  'pending', 'the card sees the request as pending');

select loyalty.request_redemption(:'token', :'cafe') as req2 \gset
select is(loyalty.get_redemption_request(:'token', (:'req1'::jsonb ->> 'requestId')::uuid) ->> 'status',
  'replaced', 'a new request replaces the previous one');

-- Mostrador -------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select is(loyalty.find_redemption_request(:'biz', :'req1'::jsonb ->> 'code'), null,
  'the replaced code no longer works');
select results_eq(
  format($$ select r ->> 'customerName', r ->> 'rewardName', (r ->> 'enough')::boolean
              from loyalty.find_redemption_request(%L, lower(%L)) r $$, :'biz', :'req2'::jsonb ->> 'code'),
  $$ values ('Rita Canje'::text, 'Café'::text, true) $$,
  'staff finds the live request by code (case-insensitive)');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.find_redemption_request(%L, %L) $$, :'biz', :'req2'::jsonb ->> 'code'),
  '42501', null, 'another business cannot look up my requests');
select throws_ok(format($$ select loyalty.confirm_redemption_request(%L) $$, :'req2'::jsonb ->> 'requestId'),
  '42501', null, 'another business cannot confirm my requests');

select tests.authenticate_as(:'staff');
select (loyalty.confirm_redemption_request((:'req2'::jsonb ->> 'requestId')::uuid)).id as redemption \gset
select is((select points_balance from loyalty.members where id = :'rita_m'), 3::bigint,
  'confirming takes the points (8 - 5)');
select is((loyalty.confirm_redemption_request((:'req2'::jsonb ->> 'requestId')::uuid)).id, :'redemption'::uuid,
  'confirming twice returns the same redemption (idempotent)');
select is((select points_balance from loyalty.members where id = :'rita_m'), 3::bigint,
  '...and does not take points again');

select tests.authenticate_as_anon();
select results_eq(
  format($$ select r ->> 'status', (r ->> 'redemptionCode') is not null
              from loyalty.get_redemption_request(%L, %L) r $$, :'token', :'req2'::jsonb ->> 'requestId'),
  $$ values ('confirmed'::text, true) $$,
  'the card sees "redeemed" with the receipt code');

-- Vencido -----------------------------------------------------------------------------------
reset role;
select loyalty.post_movement(m, 10, 'adjustment', null, null, 'Más saldo')
  from loyalty.members m where m.id = :'rita_m';
select tests.authenticate_as_anon();
select loyalty.request_redemption(:'token', :'cafe') as req3 \gset
reset role;
update loyalty.redemption_requests set expires_at = now() - interval '1 second'
 where id = (:'req3'::jsonb ->> 'requestId')::uuid;
select tests.authenticate_as(:'staff');
select is(loyalty.find_redemption_request(:'biz', :'req3'::jsonb ->> 'code'), null,
  'an expired code is not found');
select throws_ok(format($$ select loyalty.confirm_redemption_request(%L) $$, :'req3'::jsonb ->> 'requestId'),
  '22023', 'request_expired', 'an expired request cannot be confirmed');
select tests.authenticate_as_anon();
select is(loyalty.get_redemption_request(:'token', (:'req3'::jsonb ->> 'requestId')::uuid) ->> 'status',
  'expired', 'the card sees it as expired');

-- Límite y tabla cerrada -------------------------------------------------------------------
select loyalty.request_redemption(:'token', :'cafe') from generate_series(1, 7);
select throws_ok(format($$ select loyalty.request_redemption(%L, %L) $$, :'token', :'cafe'),
  '54000', null, 'at most 10 requests per hour per card');
select tests.authenticate_as(:'owner');
select throws_ok('select 1 from loyalty.redemption_requests', '42501', null,
  'nobody reads the requests table directly');

select * from finish();
rollback;
