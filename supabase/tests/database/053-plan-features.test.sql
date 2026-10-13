-- Funciones y límites por plan (D-044): Barrio no tiene automático, alta por QR ni
-- caja, y tiene tope de clientes y de equipo; el piloto tiene todo.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select tests.create_user('barrio@test.local') as owner \gset
select tests.create_user('cajero1@test.local') as staff1 \gset
select tests.create_user('cajero2@test.local') as staff2 \gset
select tests.create_user('cajero3@test.local') as staff3 \gset
select tests.create_business('kiosco-barrio', :'owner') as biz \gset
select tests.create_business('kiosco-piloto', :'owner') as pilot_biz \gset
insert into core.subscriptions (business_id, plan_id, status) values (:'biz', 'barrio', 'active');

select tests.authenticate_as(:'owner');
select is(core.my_plan(:'biz') ->> 'planId', 'barrio', 'the panel sees the plan of the business');
select is(core.my_plan(:'pilot_biz') ->> 'planId', 'pilot', 'a business without a plan is a pilot');

-- Funciones -----------------------------------------------------------------------
select throws_ok(
  format($$ select core.set_automation(%L, 'at_risk', true, 14, 'Hola {nombre}') $$, :'biz'),
  '42501', null, 'Barrio cannot turn on automatic recovery');
select lives_ok(
  format($$ select core.set_automation(%L, 'at_risk', false, 14, 'Hola {nombre}') $$, :'biz'),
  'Barrio can still save it turned off');
select throws_ok(format($$ select core.set_self_signup(%L, true) $$, :'biz'),
  '42501', null, 'Barrio cannot turn on the QR sign-up');
select throws_ok(format($$ select core.create_integration_key(%L, 'Caja') $$, :'biz'),
  '42501', null, 'Barrio cannot connect the cash register');
select throws_ok(format($$ select core.simulate_sale(%L, 1000) $$, :'biz'),
  '42501', null, 'Barrio cannot use the cash register simulator');
select lives_ok(
  format($$ select core.set_automation(%L, 'at_risk', true, 14, 'Hola {nombre}') $$, :'pilot_biz'),
  'the pilot has everything');

-- Si un negocio baja de plan, lo que ya estaba prendido deja de funcionar.
reset role;
update core.automations set enabled = true where business_id = :'biz';
select is(
  (select count(*)::int from core.automations a
    where a.enabled and core.has_feature(a.business_id, 'automations') and a.business_id = :'biz'),
  0, 'the daily engine skips automations of plans without the feature');

-- Límites ---------------------------------------------------------------------------
select tests.add_member(:'biz', :'staff1', 'staff');
-- Al invitar ya se controla el tope (D-047): 1 miembro + 1 invitación pendiente = 2.
select tests.authenticate_as(:'owner');
select lives_ok(format($$ select core.create_invitation(%L, 'nuevo@test.local', 'staff') $$, :'biz'),
  'Barrio can invite while under the team limit');
select throws_ok(format($$ select core.create_invitation(%L, 'otro@test.local', 'staff') $$, :'biz'),
  '54000', null, 'an invitation over the team limit is refused when inviting');
select lives_ok(format($$ select core.create_invitation(%L, 'nuevo@test.local', 'staff') $$, :'biz'),
  'replacing the pending invitation for the same email is still allowed');
reset role;
update core.invitations set revoked_at = now() where business_id = :'biz' and revoked_at is null;
select tests.add_member(:'biz', :'staff2', 'staff');
select throws_ok(format($$ select tests.add_member(%L, %L, 'staff') $$, :'biz', :'staff3'),
  '54000', null, 'Barrio allows 2 team members besides the owner');

update core.plans set features = jsonb_set(features, '{max_customers}', '2') where id = 'barrio';
insert into core.customers (business_id, name) values (:'biz', 'Uno');
insert into core.customers (business_id, name) values (:'biz', 'Dos');
select throws_ok(format($$ insert into core.customers (business_id, name) values (%L, 'Tres') $$, :'biz'),
  '54000', null, 'the customer limit of the plan is enforced');
select lives_ok(format($$ insert into core.customers (business_id, name) values (%L, 'Sin tope') $$, :'pilot_biz'),
  'the pilot has no customer limit');

select * from finish();
rollback;
