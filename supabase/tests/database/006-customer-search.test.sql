-- core.search_customers: búsqueda por nombre/teléfono/email respetando el negocio.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('owner_b@test.local') as owner_b \gset
select tests.create_business('kiosco', :'owner') as biz \gset
select tests.create_business('kiosco-b', :'owner_b') as biz_b \gset

insert into core.customers (business_id, name, phone, email) values
  (:'biz', 'Ana Gómez', '+5491122334455', 'ana@mail.com'),
  (:'biz', 'Mariana López', '+5491166667777', null),
  (:'biz', 'Don Carlos', null, null),
  (:'biz', 'Pedro 100%_real', null, null),
  (:'biz_b', 'Ana Ajena', '+5491199998888', null);
update core.customers set status = 'archived' where name = 'Pedro 100%_real';
insert into core.customers (business_id, name) values (:'biz', 'Juan 100 Real');

select tests.backfill_visits((select id from core.customers where name = 'Don Carlos' and business_id = :'biz'), array[1, 8, 15]);

select tests.authenticate_as(:'owner');

select results_eq(
  format($$ select name from core.search_customers(%L, 'ana') order by name $$, :'biz'),
  $$ values ('Ana Gómez'), ('Mariana López') $$,
  'partial, case-insensitive name search within the business');
select results_eq(
  format($$ select name from core.search_customers(%L, 'ana') limit 1 $$, :'biz'),
  $$ values ('Ana Gómez') $$,
  'names starting with the text come first');
select results_eq(
  format($$ select name from core.search_customers(%L, '11 2233') $$, :'biz'),
  $$ values ('Ana Gómez') $$,
  'phone search ignores spaces and symbols');
select results_eq(
  format($$ select name from core.search_customers(%L, 'ANA@MAIL') $$, :'biz'),
  $$ values ('Ana Gómez') $$,
  'email search');
select is_empty(
  format($$ select 1 from core.search_customers(%L, '100%%_') $$, :'biz'),
  'LIKE wildcards typed by the user are escaped (and archived customers are hidden)');
select results_eq(
  format($$ select name from core.search_customers(%L) limit 1 $$, :'biz'),
  $$ values ('Don Carlos') $$,
  'without text, the most recent visitors come first');
select results_eq(
  format($$ select name from core.search_customers(%L, null, 'ACTIVE') $$, :'biz'),
  $$ values ('Don Carlos') $$,
  'filter by status');
select is(
  (select count(*)::int from core.search_customers(:'biz', null, null, 2)), 2,
  'limit is applied');

-- Aislamiento: buscar en otro negocio no devuelve nada (RLS).
select is_empty(
  format($$ select 1 from core.search_customers(%L, 'ana') $$, :'biz_b'),
  'cannot search customers of another business');

select tests.authenticate_as_anon();
select throws_ok(
  format($$ select * from core.search_customers(%L) $$, :'biz'),
  '42501', null, 'anon cannot search');

select * from finish();
rollback;
