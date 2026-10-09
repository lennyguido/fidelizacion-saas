-- Dos dueños: ninguno puede quitarle el rol de dueño al otro.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.create_user('ana@test.local') as ana \gset
select tests.create_user('beto@test.local') as beto \gset
select tests.create_user('caro@test.local') as caro \gset
select tests.create_business('panaderia', :'ana') as biz \gset
select tests.add_member(:'biz', :'beto', 'owner');
select tests.add_member(:'biz', :'caro', 'admin');

select id as ana_m from core.memberships where business_id = :'biz' and user_id = :'ana' \gset
select id as beto_m from core.memberships where business_id = :'biz' and user_id = :'beto' \gset
select id as caro_m from core.memberships where business_id = :'biz' and user_id = :'caro' \gset

select tests.authenticate_as(:'beto');
select throws_ok(
  format($$ select core.update_member(%L, 'admin', 'active') $$, :'ana_m'),
  '42501', 'owner_protected', 'an owner cannot demote another owner');
select throws_ok(
  format($$ select core.update_member(%L, 'owner', 'disabled') $$, :'ana_m'),
  '42501', 'owner_protected', 'an owner cannot disable another owner');
select throws_ok(
  format($$ select core.update_member(%L, 'staff', 'disabled') $$, :'ana_m'),
  '42501', 'owner_protected', 'an owner cannot demote and disable another owner at once');
select lives_ok(
  format($$ select core.update_member(%L, 'owner', 'active') $$, :'ana_m'),
  'saving another owner without changes is allowed');
select lives_ok(
  format($$ select core.update_member(%L, 'owner', 'active') $$, :'caro_m'),
  'an owner can promote an admin to owner');
select lives_ok(
  format($$ select core.update_member(%L, 'admin', 'active') $$, :'beto_m'),
  'an owner can step down by themselves while another owner remains');

reset role;
select results_eq(
  format($$ select role, status from core.memberships where id = %L $$, :'ana_m'),
  $$ values ('owner', 'active') $$,
  'the first owner keeps the owner role');

select * from finish();
rollback;
