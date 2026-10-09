-- Fidelización: topes contra puntos fabricados, tarjeta de clientes archivados,
-- salir del programa borra el link y fallas del trigger registradas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_business('panaderia', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Ana Atrasada') as ana \gset
select tests.create_customer(:'biz', 'Beto Topes') as beto \gset
select tests.create_customer(:'biz', 'Caro Diaria') as caro \gset
select tests.create_customer(:'biz', 'Dani Archivada') as dani \gset

-- El tope diario cuenta el día en la zona del negocio: si en Buenos Aires son
-- menos de la 01:00, las visitas de hace 25 minutos caerían el día anterior.
-- En ese caso se usa UTC (3 horas más) para que el test no dependa de la hora.
update core.businesses
   set timezone = case when (now() at time zone timezone)::time < '01:00' then 'UTC' else timezone end
 where id = :'biz';

-- 1 punto por visita + 1 punto cada $1.000.
insert into loyalty.programs (business_id, points_per_visit, points_per_amount, amount_step_minor)
values (:'biz', 1, 1, 100000);

select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'ana')).id as ana_m \gset
select (loyalty.enroll_customer(:'beto')).id as beto_m \gset
select (loyalty.enroll_customer(:'caro')).id as caro_m \gset
select (loyalty.enroll_customer(:'dani')).id as dani_m \gset

-- Programa: columnas nuevas ---------------------------------------------------------
select results_eq(
  format($$ select max_visits_per_day, max_points_per_visit from loyalty.programs where business_id = %L $$, :'biz'),
  $$ values (3, 1000) $$,
  'programs default to 3 visits per day and 1000 points per visit');
select is_empty(
  format($$ update loyalty.programs set max_points_per_visit = 50 where business_id = %L returning 1 $$, :'biz'),
  'staff cannot change the caps');
select tests.authenticate_as(:'owner');
select lives_ok(
  format($$ update loyalty.programs set max_points_per_visit = 50 where business_id = %L $$, :'biz'),
  'the owner can change the per-visit cap');
select throws_ok(
  format($$ update loyalty.programs set max_visits_per_day = 0 where business_id = %L $$, :'biz'),
  '23514', null, 'the daily visit limit must be between 1 and 50');

-- Visitas atrasadas ------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select lives_ok(
  format($$ select core.record_visit(%L, null, %L, 999900000, now() - interval '2 days') $$, :'biz', :'ana'),
  'a backdated visit is still recorded in the core');
select core.record_visit(:'biz', null, :'ana', 100000, now() - interval '31 minutes');
reset role;
select is((select points_balance from loyalty.members where id = :'ana_m'), 0::bigint,
  'backdated or late visits (more than 30 minutes ago) give no points');
select is((select count(*)::int from core.visits where customer_id = :'ana'), 2,
  'both late visits exist in the core');

-- Tope por visita ----------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select core.record_visit(:'biz', null, :'beto', 999900000, now() - interval '2 minutes');
reset role;
select is((select points_balance from loyalty.members where id = :'beto_m'), 50::bigint,
  'a huge amount is capped at max_points_per_visit');

-- Tope de visitas por día ----------------------------------------------------------------
update loyalty.programs set max_points_per_visit = 1000 where business_id = :'biz';
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'caro', null, now() - interval '25 minutes')).id as c1 \gset
select core.record_visit(:'biz', null, :'caro', null, now() - interval '20 minutes');
select core.record_visit(:'biz', null, :'caro', null, now() - interval '15 minutes');
select (core.record_visit(:'biz', null, :'caro', null, now() - interval '10 minutes')).id as c4 \gset
reset role;
select is((select points_balance from loyalty.members where id = :'caro_m'), 3::bigint,
  'only max_visits_per_day (3) visits give points on the same day');
select is((select count(*)::int from loyalty.ledger where visit_id = :'c4'), 0,
  'the fourth visit of the day is not credited');

-- Una visita anulada deja de contar para el tope.
select tests.authenticate_as(:'owner');
select core.void_visit(:'c1', 'Cargada por error');
select tests.authenticate_as(:'staff');
select core.record_visit(:'biz', null, :'caro', null, now() - interval '5 minutes');
reset role;
select is((select points_balance from loyalty.members where id = :'caro_m'), 3::bigint,
  'after voiding a credited visit, a new visit that day can earn points again');

-- Tarjeta de cliente archivado ---------------------------------------------------------
select tests.authenticate_as(:'staff');
select loyalty.issue_card(:'dani_m') as token \gset
select tests.authenticate_as_anon();
select isnt(loyalty.get_card(:'token'), null, 'the card works while the customer is active');
reset role;
update core.customers set status = 'archived' where id = :'dani';
select tests.authenticate_as_anon();
select is(loyalty.get_card(:'token'), null, 'the card shows nothing for an archived customer');

-- Salir del programa borra el link -------------------------------------------------------
reset role;
update core.customers set status = 'active' where id = :'dani';
select tests.authenticate_as(:'staff');
select loyalty.leave_program(:'dani_m');
select loyalty.enroll_customer(:'dani');
reset role;
select is((select count(*)::int from loyalty.cards where member_id = :'dani_m'), 0,
  'leaving the program deletes the card link (it does not come back after re-enrolling)');

-- Un evento mal formado no aborta la transacción y queda registrado ----------------------
select core.emit_event(:'biz', 'visit.recorded',
  jsonb_build_object('visit_id', 'not-a-uuid', 'customer_id', :'ana'));
select is((select count(*)::int from loyalty.event_failures where business_id = :'biz'), 1,
  'a malformed event does not abort the transaction and is recorded in event_failures');

select * from finish();
rollback;
