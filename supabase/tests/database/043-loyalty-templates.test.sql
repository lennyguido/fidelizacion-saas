-- Plantillas de programa por rubro: loyalty.apply_template / list_templates.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('heladeria-t', :'owner') as biz \gset
select tests.create_business('otro-t', :'other') as biz2 \gset
select tests.add_member(:'biz', :'admin', 'admin');
select tests.add_member(:'biz', :'staff', 'staff');

select tests.authenticate_as(:'staff');
select is(jsonb_array_length(loyalty.list_templates()), 6, 'there are 6 templates (5 trades + other)');
select throws_ok(format($$ select loyalty.apply_template(%L, 'heladeria') $$, :'biz'),
  '42501', null, 'staff cannot apply a template');
select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.apply_template(%L, 'heladeria') $$, :'biz'),
  '42501', null, 'another business cannot apply a template to mine');

-- Programa nuevo ---------------------------------------------------------------------
select tests.authenticate_as(:'admin');
select throws_ok(format($$ select loyalty.apply_template(%L, 'zapateria') $$, :'biz'),
  '22023', 'invalid template', 'an unknown template is rejected');
select is(loyalty.apply_template(:'biz', 'heladeria') ->> 'headline', 'Sumate al club: tu 7.º helado es gratis',
  'the admin applies the ice-cream template and gets its poster headline');
select results_eq(
  format($$ select kind, points_per_visit, points_per_amount, template, enabled
             from loyalty.programs where business_id = %L $$, :'biz'),
  $$ values ('stamps'::text, 1, 0, 'heladeria'::text, true) $$,
  'the template sets a stamp card, 1 stamp per visit');
select results_eq(
  format($$ select name, cost_points from loyalty.rewards where business_id = %L and active order by cost_points $$, :'biz'),
  $$ values ('Cucurucho de regalo'::text, 6), ('1/4 kg de helado de regalo'::text, 12) $$,
  'and two rewards with concrete texts');

-- Sin movimientos todavía: se puede cambiar de plantilla --------------------------------
select lives_ok(format($$ select loyalty.apply_template(%L, 'petshop') $$, :'biz'),
  'a program without movements can switch templates');
select results_eq(
  format($$ select kind, points_per_amount, amount_step_minor from loyalty.programs where business_id = %L $$, :'biz'),
  $$ values ('points'::text, 1, 500000::bigint) $$,
  'the pet shop template gives points by amount');
select is((select count(*)::int from loyalty.rewards where business_id = :'biz' and active), 2,
  'previous rewards are deactivated, not duplicated');
select is((select count(*)::int from loyalty.rewards where business_id = :'biz'), 4,
  'previous rewards are kept (not deleted)');

-- Con movimientos: no se pisa sin p_overwrite --------------------------------------
select tests.authenticate_as(:'staff');
select tests.create_customer(:'biz', 'Pepe Perro') as pepe \gset
select (loyalty.enroll_customer(:'pepe')).id as pepe_m \gset
select core.record_visit(:'biz', null, :'pepe', null, now());
select tests.authenticate_as(:'owner');
select throws_ok(format($$ select loyalty.apply_template(%L, 'cafeteria') $$, :'biz'),
  '22023', null, 'a program with movements is not overwritten by default');
select is((select template from loyalty.programs where business_id = :'biz'), 'petshop',
  'the program stays as it was');
select lives_ok(format($$ select loyalty.apply_template(%L, 'cafeteria', true) $$, :'biz'),
  'with p_overwrite the owner can replace it');
select is((select points_balance from loyalty.members where id = :'pepe_m'), 1::bigint,
  'member balances are not touched by a template');

select * from finish();
rollback;
