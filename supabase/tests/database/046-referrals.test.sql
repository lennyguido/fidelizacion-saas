-- Traé un amigo (D-036): código de invitación, reglas al cargarlo, premio con la
-- primera visita real del amigo (una vez), descuento si se anula, ranking y roles.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('cafe-amigos', :'owner') as biz \gset
select tests.create_business('otro-cafe', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Ana Invita') as ana \gset
select tests.create_customer(:'biz', 'Beto Amigo') as beto \gset
select tests.create_customer(:'biz', 'Caro Vieja') as caro \gset
select tests.create_customer(:'biz', 'Dani Amiga') as dani \gset
select tests.create_customer(:'other_biz', 'Eva Ajena') as eva \gset
select tests.backfill_visits(:'caro', array[10]);

insert into loyalty.programs (business_id, points_per_visit) values (:'biz', 1), (:'other_biz', 1);

select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'ana')).id as ana_m \gset
select (loyalty.enroll_customer(:'beto')).id as beto_m \gset
select (loyalty.enroll_customer(:'caro')).id as caro_m \gset
select (loyalty.enroll_customer(:'dani')).id as dani_m \gset
select referral_code as ana_code from loyalty.members where id = :'ana_m' \gset

-- Códigos ---------------------------------------------------------------------------------
select ok(:'ana_code' ~ '^[A-Z2-9]{6}$', 'every member gets a 6-character invite code');
select isnt(:'ana_code', (select member_code from loyalty.members where id = :'ana_m'),
  'the invite code is not the member code');

-- Apagado por defecto ---------------------------------------------------------------------
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'beto_m', :'ana_code'),
  '22023', 'referrals are off', 'referrals are off by default');

select tests.authenticate_as(:'staff');
select is_empty(
  format($$ update loyalty.programs set referral_enabled = true where business_id = %L returning 1 $$, :'biz'),
  'staff cannot turn referrals on');
select tests.authenticate_as(:'owner');
update loyalty.programs
   set referral_enabled = true, referral_points_referrer = 5, referral_points_friend = 3
 where business_id = :'biz';

-- Reglas ----------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'ana_m', :'ana_code'),
  '22023', 'cannot refer yourself', 'nobody can refer themselves');
select throws_ok(format($$ select loyalty.set_referrer(%L, 'ZZZZZZ') $$, :'beto_m'),
  'P0002', 'referral code not found', 'unknown codes are rejected');
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'caro_m', :'ana_code'),
  '22023', 'friend already has visits', 'the friend must be a customer without visits');
select is((loyalty.set_referrer(:'beto_m', lower(:'ana_code'))).status, 'pending',
  'staff sets who invited a new member (code is case-insensitive)');
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'beto_m', :'ana_code'),
  '23505', null, 'a member can only have one referrer');
select referral_code as beto_code from loyalty.members where id = :'beto_m' \gset
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'ana_m', :'beto_code'),
  '22023', 'referral cycle', 'no cycles: the friend cannot refer back who invited them');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.set_referrer(%L, %L) $$, :'dani_m', :'ana_code'),
  '42501', null, 'another business cannot set referrers on my members');
select is_empty(format($$ select 1 from loyalty.referrals where business_id = %L $$, :'biz'),
  'another business cannot see my referrals');

-- Premio con la primera visita real -------------------------------------------------------
reset role;
select tests.backfill_visits(:'beto', array[1]);
select is((select status from loyalty.referrals where friend_member_id = :'beto_m'), 'pending',
  'imported visits do not trigger the reward');

select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'beto', null, now())).id as beto_visit \gset
select results_eq(
  format($$ select points_balance from loyalty.members where id in (%L, %L) order by id = %L desc $$,
         :'ana_m', :'beto_m', :'ana_m'),
  $$ values (5::bigint), (4::bigint) $$,
  'first real visit: the referrer gets 5 and the friend 1 for the visit + 3 for coming');
select is((select status from loyalty.referrals where friend_member_id = :'beto_m'), 'rewarded',
  'the referral is marked as rewarded');

select (core.record_visit(:'biz', null, :'beto', null, now() - interval '5 minutes')).id as beto_visit2 \gset
select is((select points_balance from loyalty.members where id = :'ana_m'), 5::bigint,
  'the reward is given only once');

-- Anular la visita del premio lo descuenta ------------------------------------------------
select tests.authenticate_as(:'owner');
select core.void_visit(:'beto_visit', 'Carga de prueba');
select results_eq(
  format($$ select points_balance from loyalty.members where id in (%L, %L) order by id = %L desc $$,
         :'ana_m', :'beto_m', :'ana_m'),
  $$ values (0::bigint), (1::bigint) $$,
  'voiding the reward visit takes back both rewards and the visit points');
select is((select status from loyalty.referrals where friend_member_id = :'beto_m'), 'voided',
  '...and the referral cannot be rewarded again');
select is(
  (select count(*)::int from loyalty.ledger where business_id = :'biz' and reason = 'referral_voided'), 2,
  'the ledger shows both reversals');

-- Ranking ---------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select (loyalty.set_referrer(:'dani_m', :'ana_code')).status;
select throws_ok(format($$ select * from loyalty.referral_ranking(%L) $$, :'biz'),
  '42501', null, 'staff cannot see the ranking');
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select name, rewarded, pending from loyalty.referral_ranking(%L) $$, :'biz'),
  $$ values ('Ana Invita'::text, 0, 1) $$,
  'the owner sees who brings more people');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from loyalty.referral_ranking(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my ranking');

select * from finish();
rollback;
