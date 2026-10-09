-- Regresión: un cliente archivado se puede encontrar y reactivar
-- (con los permisos vigentes antes de la migración 20261009120000).
-- Es lo que usan customers.listArchived() y customers.reactivate() del SDK.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select tests.create_user('dueno@test.local') as owner \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('verduleria', :'owner') as biz \gset
select tests.create_business('carniceria', :'other') as biz2 \gset
select tests.create_customer(:'biz', 'Ema Archivada') as ema \gset
update core.customers set status = 'archived' where id = :'ema';

select tests.authenticate_as(:'owner');
select is_empty(
  format($$ select 1 from core.search_customers(%L, 'Ema') $$, :'biz'),
  'an archived customer is hidden from the normal search');
select results_eq(
  format($$ select name from core.customers where business_id = %L and status = 'archived'
            and anonymized_at is null $$, :'biz'),
  $$ values ('Ema Archivada') $$,
  'the owner can list archived customers');

select tests.authenticate_as(:'other');
select is_empty(
  format($$ select 1 from core.customers where business_id = %L and status = 'archived' $$, :'biz'),
  'another business cannot see the archived customers');
select is_empty(
  format($$ update core.customers set status = 'active' where id = %L returning 1 $$, :'ema'),
  'another business cannot reactivate them');

select tests.authenticate_as(:'owner');
select results_eq(
  format($$ update core.customers set status = 'active' where id = %L returning status $$, :'ema'),
  $$ values ('active') $$,
  'the owner can reactivate an archived customer');
select results_eq(
  format($$ select name from core.search_customers(%L, 'Ema') $$, :'biz'),
  $$ values ('Ema Archivada') $$,
  'after reactivating, the customer is back in the search');

select * from finish();
rollback;
