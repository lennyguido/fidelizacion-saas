-- Fidelización: tarjeta de sellos en el wallet (docs/WALLET.md, "Tarjeta de sellos").
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('cafe', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
update core.businesses set primary_color = '#aa3300', logo_path = :'biz' || '/logo-1.png' where id = :'biz';
insert into core.customers (business_id, name) values (:'biz', 'Rosa Pérez') returning id as rosa \gset
insert into loyalty.programs (business_id, kind) values (:'biz', 'stamps');
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Café', 3), (:'biz', 'Torta', 6);

select tests.authenticate_as(:'owner');
select (loyalty.enroll_customer(:'rosa')).id as rosa_m \gset
select loyalty.issue_card(:'rosa_m') as token \gset

-- Solo la Edge Function ---------------------------------------------------------------
select throws_ok(format($$ select loyalty.wallet_stamp_brand(%L) $$, :'biz'), '42501', null,
  'authenticated cannot call wallet_stamp_brand');
select tests.authenticate_as_anon();
select throws_ok(format($$ select loyalty.wallet_stamp_brand(%L) $$, :'biz'), '42501', null,
  'anon cannot call wallet_stamp_brand');

-- Datos del pase: tipo de programa y meta de sellos ----------------------------------
reset role;
set local role service_role;
select loyalty.wallet_issue_pass(:'token', 'google') ->> 'passId' as pass_id \gset
select is(loyalty.wallet_pass_data(:'pass_id') ->> 'programKind', 'stamps', 'the pass says it is a stamp card');
select is((loyalty.wallet_pass_data(:'pass_id') ->> 'stampGoal')::int, 3,
  'with 0 stamps the goal is the next reward');

reset role;
select tests.authenticate_as(:'owner');
select loyalty.adjust_points(:'rosa_m', 4, 'prueba');
reset role;
set local role service_role;
select is((loyalty.wallet_pass_data(:'pass_id') ->> 'stampGoal')::int, 6,
  'after the first reward the goal is the next one');

reset role;
select tests.authenticate_as(:'owner');
select loyalty.adjust_points(:'rosa_m', 4, 'prueba');
reset role;
set local role service_role;
select is((loyalty.wallet_pass_data(:'pass_id') ->> 'stampGoal')::int, 3,
  'when every reward is reached the goal is the cheapest one');
select is((loyalty.wallet_pass_data(:'pass_id') ->> 'rewardsAvailable')::int, 2,
  'both rewards are ready');

reset role;
update loyalty.rewards set active = false where business_id = :'biz';
set local role service_role;
select is(loyalty.wallet_pass_data(:'pass_id') -> 'stampGoal', 'null'::jsonb,
  'without active rewards there is no goal');

-- Marca para la imagen pública de sellos ----------------------------------------------
select is(loyalty.wallet_stamp_brand(:'biz'),
  jsonb_build_object('primaryColor', '#aa3300', 'logoPath', :'biz' || '/logo-1.png'),
  'the stamp image gets only the public color and logo');
select is(loyalty.wallet_stamp_brand(gen_random_uuid()), null, 'an unknown business gets nothing');
reset role;
update core.business_modules set enabled = false where business_id = :'biz2' and module_id = 'loyalty';
set local role service_role;
select is(loyalty.wallet_stamp_brand(:'biz2'), null, 'a business without loyalty gets nothing');
select ok(not (loyalty.wallet_stamp_brand(:'biz') ?| array['name', 'slug', 'currency']),
  'no other business data is exposed');

select * from finish();
rollback;
