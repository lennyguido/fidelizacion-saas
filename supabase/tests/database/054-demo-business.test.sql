-- "Armar demo" (D-045): solo el administrador de la plataforma; el negocio queda con
-- clientes, visitas, campaña con resultados, mensajes listos, alta por QR y socios.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('cualquiera@test.local') as stranger \gset
insert into core.platform_admins (user_id) values (:'admin');

select tests.authenticate_as(:'stranger');
select throws_ok($$ select core.create_demo_business('Café Trucho') $$,
  '42501', null, 'only the platform admin can build a demo');

select tests.authenticate_as(:'admin');
select (core.create_demo_business('Café La Esquina')).id as demo \gset
select is((select name from core.businesses where id = :'demo'), 'Café La Esquina',
  'the demo has the name of the local');
select is((select count(*)::int from core.customers where business_id = :'demo'), 24,
  'it comes with 24 sample customers');
select ok((select count(*) from core.customer_stats where business_id = :'demo' and status = 'AT_RISK') > 0,
  'some customers are at risk');
select ok((select count(*) from core.outbox where business_id = :'demo') > 0,
  'today''s messages are ready');
select ok((select coupons_redeemed >= 0 and treatment_returned > 0 from core.campaign_results(
            (select id from core.campaigns where business_id = :'demo' and automation_kind is null))),
  'the past campaign shows customers who came back');

select loyalty.seed_demo(:'demo', 'cafeteria');
select ok((select count(*) from loyalty.members where business_id = :'demo' and points_balance > 0) > 20,
  'customers join the stamp program with stamps');
select is((select template from loyalty.programs where business_id = :'demo'), 'cafeteria',
  'the program uses the template of the trade');

select * from finish();
rollback;
