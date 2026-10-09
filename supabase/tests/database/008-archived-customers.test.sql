-- Regresión: un cliente archivado se puede encontrar y reactivar.
-- Desde 20261009182015 el estado solo se cambia con core.set_customer_status.
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
select throws_ok(
  format($$ select core.set_customer_status(%L, 'active') $$, :'ema'),
  '42501', null, 'another business cannot reactivate them');

select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select (core.set_customer_status(%L, 'active')).status $$, :'ema'),
  $$ values ('active') $$,
  'the owner can reactivate an archived customer');
select results_eq(
  format($$ select name from core.search_customers(%L, 'Ema') $$, :'biz'),
  $$ values ('Ema Archivada') $$,
  'after reactivating, the customer is back in the search');

select * from finish();
rollback;
