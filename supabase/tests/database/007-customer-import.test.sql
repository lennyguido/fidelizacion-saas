-- core.import_customers: permisos, validación, duplicados y reporte.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('staff@test.local') as staff \gset
select tests.create_user('owner_b@test.local') as owner_b \gset
select tests.create_business('almacen', :'owner') as biz \gset
select tests.create_business('almacen-b', :'owner_b') as biz_b \gset
select tests.add_member(:'biz', :'staff', 'staff');
insert into core.customers (business_id, name, phone) values (:'biz', 'Ya existe', '+5491100000000');

select tests.authenticate_as(:'owner');

select core.import_customers(:'biz', $$[
  {"name": "Ana", "phone": "+5491111111111", "email": "ANA@Mail.com"},
  {"name": "  ", "phone": "+5491122222222"},
  {"name": "Teléfono mal", "phone": "1122334455"},
  {"name": "Duplicado en base", "phone": "+5491100000000"},
  {"name": "Mismo mail", "email": "ana@mail.com"},
  {"name": "Sin datos"},
  {"name": "Repetido en archivo", "phone": "+5491133333333"},
  {"name": "Repetido en archivo 2", "phone": "+5491133333333"}
]$$::jsonb) as result \gset

select is((:'result'::jsonb ->> 'inserted')::int, 3, 'valid rows are inserted');
select is(
  (select jsonb_agg(s ->> 'reason' order by (s ->> 'index')::int) from jsonb_array_elements(:'result'::jsonb -> 'skipped') s),
  '["invalid_name", "invalid_phone", "duplicate_phone", "duplicate_email", "duplicate_phone"]'::jsonb,
  'each skipped row reports its reason');
select is(
  (select jsonb_agg((s ->> 'index')::int order by (s ->> 'index')::int) from jsonb_array_elements(:'result'::jsonb -> 'skipped') s),
  '[1, 2, 3, 4, 7]'::jsonb,
  'skipped rows keep their original index');
select is(
  (select email from core.customers where business_id = :'biz' and name = 'Ana'), 'ana@mail.com',
  'emails are stored in lowercase');
select is(
  (select count(*)::int from core.customer_stats s join core.customers c on c.id = s.customer_id
    where c.business_id = :'biz' and c.source = 'import'), 3,
  'imported customers get their stats row');

select throws_ok(
  format($$ select core.import_customers(%L, '{"name": "x"}'::jsonb) $$, :'biz'),
  '22023', null, 'rows must be an array');
select throws_ok(
  format($$ select core.import_customers(%L, (select jsonb_agg(jsonb_build_object('name', 'n' || i)) from generate_series(1, 501) i)) $$, :'biz'),
  '54000', null, 'batches are limited to 500 rows');

select tests.authenticate_as(:'staff');
select throws_ok(
  format($$ select core.import_customers(%L, '[]'::jsonb) $$, :'biz'),
  '42501', null, 'staff cannot import');

select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ select core.import_customers(%L, '[{"name": "intruso"}]'::jsonb) $$, :'biz_b'),
  '42501', null, 'cannot import into another business');

select * from finish();
rollback;
