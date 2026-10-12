-- Acceso solo por invitación (D-043): sin acceso no se crea un negocio; el
-- administrador de la plataforma da accesos; el acceso se usa una vez y define
-- el plan; nadie más ve los accesos.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

update core.platform_settings set value = 'invite' where key = 'signup_mode';

select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('compradora@test.local') as buyer \gset
select tests.create_user('curioso@test.local') as stranger \gset
insert into core.platform_admins (user_id) values (:'admin');

-- Sin acceso -----------------------------------------------------------------------
select tests.authenticate_as(:'stranger');
select ok(core.my_access() is null, 'an account without an access grant has no access');
select throws_ok($$ select core.create_business('Truchada', 'truchada') $$,
  '42501', 'access_required', 'without an access grant no business can be created');
select throws_ok($$ select core.create_access_grant('yo@test.local', 'barrio') $$,
  '42501', null, 'only the platform admin can give access');

-- El administrador da un acceso ----------------------------------------------------
select tests.authenticate_as(:'admin');
select is((core.create_access_grant(' Compradora@Test.Local ', 'local', 'pagó por transferencia')).email,
  'compradora@test.local', 'the admin gives access (email normalized)');
select is((core.create_access_grant('compradora@test.local', 'barrio')).plan_id, 'barrio',
  'giving access again to the same email updates the pending grant');
select is((select count(*)::int from core.access_grants where email = 'compradora@test.local'), 1,
  'only one pending grant per email');
select throws_ok($$ select core.create_access_grant('x@test.local', 'oro') $$,
  '22023', null, 'unknown plans are rejected');

-- La compradora crea su negocio ------------------------------------------------------
select tests.authenticate_as(:'buyer');
select is(core.my_access(), 'barrio', 'the buyer sees the plan she paid for');
select is_empty('select 1 from core.access_grants', 'customers cannot read the access list');
select core.create_business('Café Compradora', 'cafe-compradora');
select results_eq(
  $$ select s.plan_id, s.status from core.subscriptions s
       join core.businesses b on b.id = s.business_id where b.slug = 'cafe-compradora' $$,
  $$ values ('barrio'::text, 'active'::text) $$,
  'the business gets the purchased plan');
select ok(core.my_access() is null, 'the grant is used: no second business with the same access');

select tests.authenticate_as(:'admin');
select is((select status from core.access_grants where email = 'compradora@test.local'), 'used',
  'the admin sees the grant as used');

select * from finish();
rollback;
