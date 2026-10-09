-- Fidelización: recompensas, canjes, ajustes y abusos.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('heladeria', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Ana Socia') as ana \gset
insert into loyalty.programs (business_id) values (:'biz');

-- Recompensas -------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(
  format($$ insert into loyalty.rewards (business_id, name, cost_points) values (%L, 'Gratis', 1) $$, :'biz'),
  '42501', null, 'staff cannot create rewards');

select tests.authenticate_as(:'owner');
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Cucurucho gratis', 3)
returning id as reward \gset
insert into loyalty.rewards (business_id, name, cost_points, active) values (:'biz', 'Vieja', 1, false)
returning id as inactive \gset
insert into loyalty.rewards (business_id, name, cost_points, available_until)
values (:'biz', 'Promo vencida', 1, now() - interval '1 day')
returning id as expired \gset
select throws_ok(
  format($$ insert into loyalty.rewards (business_id, name, cost_points) values (%L, 'Mal', 0) $$, :'biz'),
  '23514', null, 'a reward must cost at least 1 point');

select (loyalty.enroll_customer(:'ana')).id as ana_m \gset

-- Ajustes -------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select loyalty.adjust_points(%L, 5, 'Regalo') $$, :'ana_m'), '42501', null,
  'staff cannot adjust points');
select tests.authenticate_as(:'owner');
select throws_ok(format($$ select loyalty.adjust_points(%L, 5, '') $$, :'ana_m'), '22023', null,
  'an adjustment needs a reason');
select throws_ok(format($$ select loyalty.adjust_points(%L, -1, 'Quitar') $$, :'ana_m'), '22023',
  'insufficient_points', 'an adjustment cannot leave the balance negative');
select is((loyalty.adjust_points(:'ana_m', 5, 'Bienvenida')).points_balance, 5::bigint,
  'the owner adds welcome points');

-- Canjes ----------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select * into temp r1 from loyalty.redeem_reward(:'ana_m', :'reward');
select ok((select code ~ '^[A-Z2-9]{6}$' from r1), 'a redemption gets a short readable code');
select is((select points_balance from loyalty.members where id = :'ana_m'), 2::bigint,
  'the cashier redeems: 5 - 3 = 2 points left');
select throws_ok(format($$ select loyalty.redeem_reward(%L, %L) $$, :'ana_m', :'reward'), '22023',
  'insufficient_points', 'cannot redeem without enough points');
select throws_ok(format($$ select loyalty.redeem_reward(%L, %L) $$, :'ana_m', :'inactive'), '22023',
  'reward_unavailable', 'inactive rewards cannot be redeemed');
select throws_ok(format($$ select loyalty.redeem_reward(%L, %L) $$, :'ana_m', :'expired'), '22023',
  'reward_unavailable', 'expired rewards cannot be redeemed');

reset role;
select tests.authenticate_as(:'owner');
select loyalty.adjust_points(:'ana_m', 10, 'Compensación');
select tests.authenticate_as(:'staff');
select (loyalty.redeem_reward(:'ana_m', :'reward', '00000000-0000-4000-8000-000000000001')).id as r2 \gset
select is((loyalty.redeem_reward(:'ana_m', :'reward', '00000000-0000-4000-8000-000000000001')).id, :'r2'::uuid,
  'a double tap (same request id) returns the same redemption');
select is((select points_balance from loyalty.members where id = :'ana_m'), 9::bigint,
  '...and charges the points only once');

select throws_ok(
  format($$ insert into loyalty.redemptions (business_id, member_id, reward_id, reward_name, points, code)
            values (%L, %L, %L, 'x', 1, 'ABCDEF') $$, :'biz', :'ana_m', :'reward'),
  '42501', null, 'redemptions cannot be inserted directly');

-- Cancelar --------------------------------------------------------------------------
select throws_ok(format($$ select loyalty.cancel_redemption(%L, 'Error') $$, :'r2'), '42501', null,
  'staff cannot cancel redemptions');
select tests.authenticate_as(:'owner');
select is((loyalty.cancel_redemption(:'r2', 'Se equivocó de producto')).status, 'cancelled',
  'the owner cancels a redemption with a reason');
select is((select points_balance from loyalty.members where id = :'ana_m'), 12::bigint,
  'cancelling gives the points back');
select throws_ok(format($$ select loyalty.cancel_redemption(%L, 'Otra vez') $$, :'r2'), '22023', null,
  'a redemption cannot be cancelled twice');

-- Otro negocio y socios que se fueron ------------------------------------------------
select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.redeem_reward(%L, %L) $$, :'ana_m', :'reward'), '42501', null,
  'another business cannot redeem my members');
select is_empty(format($$ select 1 from loyalty.redemptions where business_id = %L $$, :'biz'),
  'another business cannot see my redemptions');

select tests.authenticate_as(:'staff');
select loyalty.leave_program(:'ana_m');
select throws_ok(format($$ select loyalty.redeem_reward(%L, %L) $$, :'ana_m', :'reward'), '22023',
  'member_inactive', 'members who left cannot redeem');

reset role;
select is(
  (select sum(delta) from loyalty.ledger where member_id = :'ana_m'),
  (select points_balance::numeric from loyalty.members where id = :'ana_m'),
  'the balance always equals the sum of the ledger');

select * from finish();
rollback;
