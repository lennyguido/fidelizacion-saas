-- Resumen de los lunes (D-035): semana local, comparación con 4–8 semanas, alertas
-- raras, habituales en riesgo, acción sugerida, roles y aislamiento.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('kiosco-lunes', :'owner') as biz \gset
select tests.create_business('otro-lunes', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select id as loc from core.locations where business_id = :'biz' \gset
update core.businesses set phone = '+5491100000000' where id = :'biz';

-- "Ahora" es el lunes 12/10/2026 al mediodía en Buenos Aires: la semana del
-- resumen va del lunes 5 al domingo 11.
create temp table t_now as select timestamptz '2026-10-12 12:00-03' as now;

-- Visitas sin cliente: 10 por semana durante las 8 semanas anteriores, 5 en la semana.
insert into core.visits (business_id, location_id, occurred_at, currency, source)
select :'biz', :'loc', timestamptz '2026-10-05 10:00-03' - make_interval(weeks => w) + make_interval(hours => i),
       'ARS', 'import'
  from generate_series(1, 8) w, generate_series(1, 10) i;
insert into core.visits (business_id, location_id, occurred_at, currency, source)
select :'biz', :'loc', timestamptz '2026-10-05 10:00-03' + make_interval(hours => i), 'ARS', 'import'
  from generate_series(1, 4) i;
-- Domingo 23:30 local (ya es lunes en UTC): cuenta en la semana.
insert into core.visits (business_id, location_id, occurred_at, currency, source)
values (:'biz', :'loc', timestamptz '2026-10-11 23:30-03', 'ARS', 'import');
-- Lunes 00:30 local de la semana en curso: no cuenta.
insert into core.visits (business_id, location_id, occurred_at, currency, source)
values (:'biz', :'loc', timestamptz '2026-10-12 00:30-03', 'ARS', 'import');

-- Roles -------------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.weekly_digest(%L) $$, :'biz'),
  '42501', null, 'staff cannot see the weekly digest');
select tests.authenticate_as(:'other');
select throws_ok(format($$ select core.weekly_digest(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my digest');
select tests.authenticate_as(:'owner');
select ok(core.weekly_digest(:'biz') ? 'visits', 'the owner gets her digest');
reset role;

-- Semana y comparación ------------------------------------------------------------------------
select core.weekly_digest_at(:'biz', (select now from t_now)) as d \gset
select is(:'d'::jsonb ->> 'weekStart', '2026-10-05', 'the week starts on the last full Monday');
select is(:'d'::jsonb ->> 'weekEnd', '2026-10-11', '...and ends on Sunday');
select is((:'d'::jsonb ->> 'visits')::int, 5,
  'visits use the business time zone (Sunday 23:30 counts, Monday 00:30 does not)');
select is((:'d'::jsonb ->> 'baselineVisits')::numeric, 10.0, 'baseline is the average of 8 weeks');
select is((:'d'::jsonb ->> 'visitsDropAlert')::boolean, true, 'a drop of more than 20% raises the alert');
select is(:'d'::jsonb -> 'action' ->> 'kind', 'turn_on_automations',
  'visits dropped and the automatic recovery is off: it suggests turning it on');
select is(:'d'::jsonb ->> 'businessPhone', '+5491100000000', 'the business phone is included for WhatsApp');

-- Con menos de 4 semanas de historia no se compara.
select is(
  core.weekly_digest_at(:'biz', timestamptz '2026-08-24 12:00-03') -> 'baselineVisits',
  'null'::jsonb, 'with less than 4 weeks of history there is no comparison');

-- Habituales en riesgo ------------------------------------------------------------------------
insert into core.customers (business_id, name, phone)
select :'biz', 'Cliente ' || i, '+54911800000' || lpad(i::text, 2, '0') from generate_series(1, 4) i;
update core.customer_stats s
   set status = 'AT_RISK', visit_count = 10 + (substr(c.name, 9)::int), last_visit_at = timestamptz '2026-09-01'
  from core.customers c where c.id = s.customer_id and c.business_id = :'biz';
update core.customer_stats s set visit_count = 2
  from core.customers c where c.id = s.customer_id and c.name = 'Cliente 4' and c.business_id = :'biz';
select core.weekly_digest_at(:'biz', (select now from t_now)) as d \gset
select results_eq(
  format($$ select e ->> 'name' from jsonb_array_elements(%L::jsonb -> 'atRiskRegulars') e $$, :'d'),
  $$ values ('Cliente 3'::text), ('Cliente 2'::text), ('Cliente 1'::text) $$,
  'up to 3 regulars at risk, those who came most first (2 visits is not a regular)');
select is(:'d'::jsonb -> 'action' ->> 'kind', 'contact_at_risk', 'then it suggests contacting one of them');
select is(:'d'::jsonb -> 'action' ->> 'name', 'Cliente 3', '...the one who came most');

-- Alertas raras -------------------------------------------------------------------------------
select id as c1 from core.customers where business_id = :'biz' and name = 'Cliente 1' \gset
insert into core.visits (business_id, location_id, customer_id, occurred_at, currency, source, created_by)
select :'biz', :'loc', :'c1', timestamptz '2026-10-06 10:00-03' + make_interval(hours => i), 'ARS', 'manual', :'staff'
  from generate_series(1, 4) i;
select core.weekly_digest_at(:'biz', (select now from t_now)) as d \gset
select results_eq(
  format($$ select e ->> 'customerName', e ->> 'staffEmail', (e ->> 'visits')::int
              from jsonb_array_elements(%L::jsonb -> 'sameStaffAlerts') e $$, :'d'),
  $$ values ('Cliente 1'::text, 'cajero@test.local'::text, 4) $$,
  'many visits of the same customer by the same employee raise an alert');
select is(:'d'::jsonb -> 'action' ->> 'kind', 'review_alerts', 'alerts come first in the suggested action');

update core.visits set voided_at = timestamptz '2026-10-07 10:00-03', void_reason = 'Prueba'
 where id in (select id from core.visits where business_id = :'biz' and customer_id is null
               and occurred_at >= timestamptz '2026-10-05 00:00-03' order by occurred_at limit 3);
select is((core.weekly_digest_at(:'biz', (select now from t_now)) ->> 'voidsAlert')::boolean, true,
  '3 voids when there are usually none raise an alert');

-- Aislamiento y semana vacía -------------------------------------------------------------------
select is((core.weekly_digest_at(:'other_biz', (select now from t_now)) ->> 'visits')::int, 0,
  'another business sees none of my visits');
select is(core.weekly_digest_at(:'other_biz', (select now from t_now)) -> 'action' ->> 'kind',
  'load_visits', 'a week without visits suggests loading them');

select * from finish();
rollback;
