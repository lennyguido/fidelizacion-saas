-- Estados del cliente y riesgo (docs/ARCHITECTURE.md §6, TASKS.md secciones 31–33).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- Función pura ------------------------------------------------------------------
-- Firma: (visitas, primera, última, mediana, estado_prev, cambio_prev, es_visita_nueva, settings, ahora)

select is(
  (core.compute_customer_status(0, null, null, null, null, now(), false, '{}', now())).status,
  'NEW', 'no visits → NEW');

select is(
  (core.compute_customer_status(1, now() - interval '3 days', now() - interval '3 days',
                                null, 'NEW', now(), false, '{}', now())).status,
  'NEW', 'a single recent visit → NEW');

-- Ejemplo de TASKS.md: compra cada 7 días, lleva 14 sin venir → riesgo.
select is(
  (core.compute_customer_status(10, now() - interval '90 days', now() - interval '14 days',
                                7, 'ACTIVE', now(), false, '{}', now())).status,
  'AT_RISK', 'weekly customer 14 days away → AT_RISK');

-- Ejemplo de TASKS.md: compra cada 35 días, lleva 14 → activo.
select is(
  (core.compute_customer_status(6, now() - interval '200 days', now() - interval '14 days',
                                35, 'ACTIVE', now(), false, '{}', now())).status,
  'ACTIVE', 'monthly customer 14 days away → ACTIVE');

select is(
  (core.compute_customer_status(10, now() - interval '90 days', now() - interval '25 days',
                                7, 'AT_RISK', now(), false, '{}', now())).status,
  'INACTIVE', 'more than 3x the usual interval → INACTIVE');

select is(
  (core.compute_customer_status(11, now() - interval '90 days', now(),
                                7, 'AT_RISK', now(), true, '{}', now())).status,
  'RECOVERED', 'coming back while AT_RISK → RECOVERED');

select is(
  (core.compute_customer_status(12, now() - interval '90 days', now() - interval '2 days',
                                7, 'RECOVERED', now() - interval '10 days', false, '{}', now())).status,
  'RECOVERED', 'RECOVERED lasts during recovered_days');

select is(
  (core.compute_customer_status(12, now() - interval '90 days', now() - interval '2 days',
                                7, 'RECOVERED', now() - interval '40 days', false, '{}', now())).status,
  'ACTIVE', 'after recovered_days RECOVERED becomes ACTIVE');

select is(
  (core.compute_customer_status(2, now() - interval '20 days', now() - interval '13 days',
                                7, 'ACTIVE', now(), false, '{}', now())).status,
  'ACTIVE', 'with fewer than 3 visits the default interval (14 days) is used');

select results_eq(
  $$ select (core.compute_customer_status(10, now() - interval '90 days', now() - interval '7 days',
                                          7, 'ACTIVE', now(), false, '{}', now())).risk_score::int
     union all
     select (core.compute_customer_status(10, now() - interval '90 days', now() - interval '14 days',
                                          7, 'ACTIVE', now(), false, '{}', now())).risk_score::int
     union all
     select (core.compute_customer_status(10, now() - interval '90 days', now() - interval '60 days',
                                          7, 'ACTIVE', now(), false, '{}', now())).risk_score::int $$,
  $$ values (0), (50), (100) $$,
  'risk score: 0 on time, 50 at 2x, capped at 100');

select is(
  (core.compute_customer_status(10, now() - interval '90 days', now() - interval '9 days', 7, 'ACTIVE',
                                now(), false, '{"customer_status": {"at_risk_factor": 1.2}}', now())).status,
  'AT_RISK', 'thresholds are configurable per business');

-- Integración: historial, mediana y recuperación ---------------------------------------
select tests.create_user('owner@test.local') as owner \gset
select tests.create_business('bar', :'owner') as biz \gset
select tests.create_customer(:'biz', 'Bruno') as bruno \gset

-- Venía cada 7 días; la última vez hace 12 días.
select tests.backfill_visits(:'bruno', array[54, 47, 40, 33, 26, 19, 12], 600000);

select is(
  (select median_interval_days from core.customer_stats where customer_id = :'bruno'), 7.00,
  'median interval is computed from visit days');
select is(
  (select status from core.customer_stats where customer_id = :'bruno'), 'AT_RISK',
  'stats mark a late weekly customer AT_RISK');

-- Vuelve al mostrador.
select tests.authenticate_as(:'owner');
select core.record_visit(:'biz', null, :'bruno', 700000);
reset role;

select is(
  (select status from core.customer_stats where customer_id = :'bruno'), 'RECOVERED',
  'a visit from an AT_RISK customer marks them RECOVERED');
select ok(
  exists (select 1 from core.customer_status_history
           where customer_id = :'bruno' and from_status = 'AT_RISK' and to_status = 'RECOVERED'),
  'the status change is stored in the history');

-- El job nocturno detecta a quien dejó de venir.
select tests.create_customer(:'biz', 'Carla') as carla \gset
select tests.backfill_visits(:'carla', array[33, 26, 19, 12], null);
update core.customer_stats set status = 'ACTIVE' where customer_id = :'carla';
select core.refresh_statuses(:'biz');
select is(
  (select status from core.customer_stats where customer_id = :'carla'), 'AT_RISK',
  'refresh_statuses moves overdue customers to AT_RISK');

select * from finish();
rollback;
