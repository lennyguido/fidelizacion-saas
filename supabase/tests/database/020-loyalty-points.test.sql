-- Fidelización: programa, socios y acreditación de puntos por visitas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('cafeteria', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Ana Socia') as ana \gset
select tests.create_customer(:'biz', 'Beto Sin Puntos') as beto \gset

-- Programa ----------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(
  format($$ insert into loyalty.programs (business_id) values (%L) $$, :'biz'),
  '42501', null, 'staff cannot create the program');

select tests.authenticate_as(:'other');
select throws_ok(
  format($$ insert into loyalty.programs (business_id) values (%L) $$, :'biz'),
  '42501', null, 'another business cannot create the program');

select tests.authenticate_as(:'owner');
select lives_ok(
  format($$ insert into loyalty.programs (business_id, points_per_visit, points_per_amount, amount_step_minor)
            values (%L, 1, 1, 100000) $$, :'biz'),
  'the owner creates the program: 1 point per visit + 1 point per $1.000');
select throws_ok(
  format($$ update loyalty.programs set points_per_visit = 0, points_per_amount = 0 where business_id = %L $$, :'biz'),
  '23514', null, 'a program must give some points');

select tests.authenticate_as(:'staff');
select is_empty(
  format($$ update loyalty.programs set points_per_visit = 50 where business_id = %L returning 1 $$, :'biz'),
  'staff cannot change the program');

-- Socios ------------------------------------------------------------------------
select (loyalty.enroll_customer(:'ana')).id as ana_m \gset
select is((loyalty.enroll_customer(:'ana')).id, :'ana_m'::uuid, 'enrolling twice returns the same member');
reset role;
select is(
  (select count(*)::int from core.events where business_id = :'biz' and type = 'loyalty.member_joined'), 1,
  'joining emits one event');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.enroll_customer(%L) $$, :'beto'), '42501', null,
  'another business cannot enroll my customers');
select is_empty(format($$ select 1 from loyalty.members where business_id = %L $$, :'biz'),
  'another business cannot see my members');

-- Acreditación -------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'ana', 350000, now() - interval '3 hours')).id as v1 \gset
select is((select points_balance from loyalty.members where id = :'ana_m'), 4::bigint,
  'a $3.500 visit gives 1 + 3 = 4 points (rounded down)');
select is((select lifetime_points from loyalty.members where id = :'ana_m'), 4::bigint, 'lifetime points too');

select core.record_visit(:'biz', null, :'beto', 350000, now() - interval '3 hours');
select is((select count(*)::int from loyalty.members where customer_id = :'beto'), 0,
  'customers who did not join get no points (and are not enrolled automatically)');
select lives_ok(format($$ select core.record_visit(%L) $$, :'biz'), 'anonymous visits still work');

select throws_ok(
  format($$ insert into loyalty.ledger (business_id, member_id, delta, reason) values (%L, %L, 100, 'adjustment') $$,
         :'biz', :'ana_m'),
  '42501', null, 'the ledger cannot be written directly');
select throws_ok(
  format($$ update loyalty.members set points_balance = 999 where id = %L $$, :'ana_m'),
  '42501', null, 'balances cannot be edited directly');

-- Doble acreditación y reversión --------------------------------------------------
reset role;
select core.emit_event(:'biz', 'visit.recorded',
  jsonb_build_object('visit_id', :'v1', 'customer_id', :'ana', 'amount_minor', 350000, 'source', 'manual'));
select is((select points_balance from loyalty.members where id = :'ana_m'), 4::bigint,
  'the same visit is never credited twice');
select throws_ok(
  format($$ delete from loyalty.ledger where member_id = %L $$, :'ana_m'),
  '42501', 'the points ledger is append-only', 'the ledger is append-only (even for the database owner)');

select tests.authenticate_as(:'owner');
select core.void_visit(:'v1', 'Cargada por error');
select is((select points_balance from loyalty.members where id = :'ana_m'), 0::bigint,
  'voiding the visit takes the points back');
select is(
  (select delta from loyalty.ledger where visit_id = :'v1' and reason = 'visit_voided'), -4::bigint,
  'the reversal is a new ledger entry');

-- Importaciones, módulo apagado, salir del programa --------------------------------
reset role;
select tests.backfill_visits(:'ana', array[2], 900000);
select id as v_import from core.visits where customer_id = :'ana' and source = 'import' \gset
select core.emit_event(:'biz', 'visit.recorded',
  jsonb_build_object('visit_id', :'v_import', 'customer_id', :'ana', 'amount_minor', 900000, 'source', 'import'));
select is((select points_balance from loyalty.members where id = :'ana_m'), 0::bigint,
  'imported (historical) visits give no points');

update core.business_modules set enabled = false where business_id = :'biz' and module_id = 'loyalty';
select tests.authenticate_as(:'staff');
select core.record_visit(:'biz', null, :'ana', null, now() - interval '1 hour');
select is_empty(format($$ select 1 from loyalty.members where business_id = %L $$, :'biz'),
  'with the module disabled the team does not see loyalty data');
reset role;
select is((select points_balance from loyalty.members where id = :'ana_m'), 0::bigint,
  'no points while the loyalty module is disabled');
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select loyalty.enroll_customer(%L) $$, :'beto'), '42501', 'module_disabled',
  'cannot enroll while the module is disabled');

reset role;
update core.business_modules set enabled = true where business_id = :'biz' and module_id = 'loyalty';
select tests.authenticate_as(:'staff');
select loyalty.leave_program(:'ana_m');
select core.record_visit(:'biz', null, :'ana', null, now() - interval '30 minutes');
select is((select points_balance from loyalty.members where id = :'ana_m'), 0::bigint,
  'members who left get no points');

-- Mínimo de compra -------------------------------------------------------------------
reset role;
update loyalty.programs set min_amount_minor = 500000 where business_id = :'biz';
select results_eq(
  format($$ select loyalty.points_for_visit(p, 350000), loyalty.points_for_visit(p, 600000)
              from loyalty.programs p where business_id = %L $$, :'biz'),
  $$ values (1::bigint, 7::bigint) $$,
  'below the minimum only the visit point counts; above it, amount points too');

select * from finish();
rollback;
