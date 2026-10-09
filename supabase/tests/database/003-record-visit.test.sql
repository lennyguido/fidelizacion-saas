-- core.record_visit / core.void_visit: validaciones, idempotencia, estadísticas y eventos.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select tests.create_user('owner@test.local') as owner \gset
select tests.create_user('staff@test.local') as staff \gset
select tests.create_business('cafe', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Ana') as ana \gset

select tests.authenticate_as(:'staff');

-- Visita básica con monto ----------------------------------------------------------
select (core.record_visit(:'biz', null, :'ana', 850000)).id as v1 \gset

select results_eq(
  format('select visit_count, total_spend_minor, avg_ticket_minor from core.customer_stats where customer_id = %L', :'ana'),
  $$ values (1, 850000::bigint, 850000::bigint) $$,
  'stats are updated after a visit');
select is(
  (select currency from core.visits where id = :'v1'), 'ARS',
  'visit takes the business currency');
select is(
  (select created_by from core.visits where id = :'v1'), :'staff'::uuid,
  'visit records who registered it');

-- Doble carga accidental -----------------------------------------------------------
select throws_ok(
  format('select core.record_visit(%L, null, %L, 100)', :'biz', :'ana'),
  '23505', null, 'a second visit of the same customer a moment later is rejected');

-- Visita anónima y sin monto -------------------------------------------------------
select isnt(
  (select (core.record_visit(:'biz')).id), null,
  'anonymous visits without amount are allowed');

-- Idempotencia por referencia externa ------------------------------------------------
select (core.record_visit(:'biz', null, null, 1000, null, 'qr_business', 'ticket-123')).id as r1 \gset
select (core.record_visit(:'biz', null, null, 9999, null, 'qr_business', 'ticket-123')).id as r2 \gset
select is(:'r2'::uuid, :'r1'::uuid, 'same source_ref returns the same visit');
select is(
  (select count(*)::int from core.visits where source_ref = 'ticket-123'), 1,
  'same source_ref is stored only once');

-- Validaciones ---------------------------------------------------------------------
select throws_ok(
  format($$ select core.record_visit(%L, null, null, -1) $$, :'biz'),
  '22023', null, 'negative amounts are rejected');
select throws_ok(
  format($$ select core.record_visit(%L, null, null, null, now() + interval '1 day') $$, :'biz'),
  '22023', null, 'future visits are rejected');
select throws_ok(
  format($$ select core.record_visit(%L, null, null, null, now() - interval '30 days') $$, :'biz'),
  '22023', null, 'old visits require source import');
select throws_ok(
  format($$ select core.record_visit(%L, null, null, null, null, 'mercadopago') $$, :'biz'),
  '22023', null, 'integration sources are reserved');
select throws_ok(
  format($$ select core.record_visit(%L, null, null, null, now() - interval '30 days', 'import') $$, :'biz'),
  '42501', null, 'staff cannot import visits');

-- Escritura directa prohibida ----------------------------------------------------------
select throws_ok(
  format($$ insert into core.visits (business_id, location_id, currency, source)
            values (%L, (select id from core.locations where business_id = %L), 'ARS', 'manual') $$,
         :'biz', :'biz'),
  '42501', null, 'visits cannot be inserted directly');
select throws_ok(
  format($$ update core.customer_stats set total_spend_minor = 999999999 where customer_id = %L $$, :'ana'),
  '42501', null, 'stats cannot be modified directly');

-- Anulación ----------------------------------------------------------------------------
select throws_ok(
  format($$ select core.void_visit(%L, 'error de carga') $$, :'v1'),
  '42501', null, 'staff cannot void visits');

select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ select core.void_visit(%L, '') $$, :'v1'),
  '22023', null, 'voiding requires a reason');
select lives_ok(
  format($$ select core.void_visit(%L, 'error de carga') $$, :'v1'),
  'owner can void a visit');
select results_eq(
  format('select visit_count, total_spend_minor from core.customer_stats where customer_id = %L', :'ana'),
  $$ values (0, 0::bigint) $$,
  'stats are recalculated after voiding');
select throws_ok(
  format($$ select core.void_visit(%L, 'otra vez') $$, :'v1'),
  '22023', null, 'a visit cannot be voided twice');

-- Varias sucursales: hay que elegir ------------------------------------------------------
reset role;
insert into core.locations (business_id, name) values (:'biz', 'Segunda');
select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ select core.record_visit(%L) $$, :'biz'),
  '22023', null, 'location is required when there are several locations');

-- Eventos y auditoría --------------------------------------------------------------------
reset role;
select ok(
  (select count(*) from core.events where business_id = :'biz' and type = 'visit.recorded') >= 3,
  'visit.recorded events are emitted');
select ok(
  exists (select 1 from core.audit_log where business_id = :'biz' and table_name = 'core.visits'
           and action = 'update' and new_data ? 'voided_at'),
  'voiding is audited');

select * from finish();
rollback;
