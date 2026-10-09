-- core.create_business / core.is_slug_available (onboarding del negocio).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select tests.create_user('nuevo@test.local') as owner \gset
select tests.create_user('otro@test.local') as other \gset

-- Sin sesión no se puede crear nada.
select tests.authenticate_as_anon();
select throws_ok($$ select core.create_business('X', 'x') $$, '42501', null,
  'anon cannot create businesses');

select tests.authenticate_as(:'owner');

select ok(core.is_slug_available('mi-cafe'), 'a free slug is available');
select ok(not core.is_slug_available('admin'), 'reserved slugs are not available');
select ok(not core.is_slug_available('Mi Cafe'), 'invalid slugs are not available');

select (core.create_business('  Mi Café  ', 'Mi-Cafe')).id as biz \gset

select results_eq(
  format('select name, slug, status from core.businesses where id = %L', :'biz'),
  $$ values ('Mi Café', 'mi-cafe', 'active') $$,
  'business is created with trimmed name and normalized slug');
select results_eq(
  format('select role from core.memberships where business_id = %L', :'biz'),
  $$ values ('owner') $$,
  'the creator becomes the owner');
select is(
  (select count(*)::int from core.locations where business_id = :'biz'), 1,
  'a main location is created');
select set_eq(
  format('select module_id from core.business_modules where business_id = %L', :'biz'),
  $$ values ('loyalty'), ('recovery') $$,
  'pilot plan modules are enabled');
select results_eq(
  format('select plan_id, status from core.subscriptions where business_id = %L', :'biz'),
  $$ values ('pilot', 'trialing') $$,
  'a trial subscription is created');
select ok(not core.is_slug_available('mi-cafe'), 'a used slug is no longer available');

-- El dueño ya puede registrar visitas en su negocio nuevo.
select isnt((core.record_visit(:'biz')).id, null, 'the new owner can record visits right away');

-- Errores esperables.
select throws_ok($$ select core.create_business('Copia', 'mi-cafe') $$, '23505', 'slug_taken',
  'duplicate slugs are rejected');
select throws_ok($$ select core.create_business('', 'vacio') $$, '22023', null,
  'name is required');

select lives_ok($$ select core.create_business('Dos', 'negocio-dos') $$, 'second business');
select lives_ok($$ select core.create_business('Tres', 'negocio-tres') $$, 'third business');
select throws_ok($$ select core.create_business('Cuatro', 'negocio-cuatro') $$, '54000', null,
  'a user cannot own more than 3 businesses');

select * from finish();
rollback;
