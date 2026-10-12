-- Estadísticas del dueño (D-042): totales, comparación, nuevos/recurrentes y roles.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('kiosco-stats', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Vieja') as vieja \gset
select tests.create_customer(:'biz', 'Nueva') as nueva \gset
-- Vieja: una visita hace 60 días y dos en el período; Nueva: una en el período.
select tests.backfill_visits(:'vieja', array[60, 3, 2], 100000);
select tests.backfill_visits(:'nueva', array[1], 300000);

select tests.authenticate_as(:'owner');
select core.business_stats(:'biz', 30) as s \gset
select is((:'s'::jsonb -> 'totals' ->> 'visits')::int, 3, 'visits in the last 30 days');
select is((:'s'::jsonb -> 'totals' ->> 'customers')::int, 2, 'unique customers');
select is((:'s'::jsonb -> 'totals' ->> 'avgTicketMinor')::int, 166667, 'average ticket only from visits with amount');
select is(:'s'::jsonb -> 'newVsReturning', '{"new": 1, "returning": 1}'::jsonb,
  'new versus returning customers');
select is(jsonb_array_length(:'s'::jsonb -> 'daily'), 30, 'one point per day');

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.business_stats(%L, 30) $$, :'biz'),
  '42501', null, 'staff cannot see the statistics');
select tests.authenticate_as(:'other');
select throws_ok(format($$ select core.business_stats(%L, 30) $$, :'biz'),
  '42501', null, 'another business cannot see my statistics');

select * from finish();
rollback;
