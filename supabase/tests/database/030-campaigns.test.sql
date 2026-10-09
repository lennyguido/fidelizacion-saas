-- Campañas: segmentos, consentimiento, grupo de control y resultados.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('pizzeria', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');

-- 10 en riesgo con WhatsApp aceptado, 3 sin consentimiento, 2 que lo revocaron,
-- 1 archivado, 4 activos con consentimiento.
create temp table seeds as
select g, 'Cliente ' || g as name, '+54911000000' || lpad(g::text, 2, '0') as phone,
       case when g <= 16 then 'AT_RISK' else 'ACTIVE' end as status,
       case when g between 11 and 13 then null when g between 14 and 15 then false else true end as consent
  from generate_series(1, 20) g;
insert into core.customers (business_id, name, phone)
select :'biz', name, phone from seeds;
update core.customer_stats s set status = seeds.status
  from core.customers c join seeds on seeds.name = c.name
 where s.customer_id = c.id and c.business_id = :'biz';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '10 days'
  from core.customers c join seeds on seeds.name = c.name
 where c.business_id = :'biz' and seeds.consent is not null;
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
select :'biz', c.id, 'whatsapp', 'marketing', false, 'reply_opt_out'
  from core.customers c join seeds on seeds.name = c.name
 where c.business_id = :'biz' and seeds.consent = false;
update core.customers set status = 'archived' where business_id = :'biz' and name = 'Cliente 16';

-- Segmentos ------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select * from core.preview_segment(%L, '{"statuses":["AT_RISK"]}') $$, :'biz'),
  '42501', null, 'staff cannot build campaigns');

select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select matching, reachable from core.preview_segment(%L, '{"statuses":["AT_RISK"]}') $$, :'biz'),
  $$ values (15, 10) $$,
  'at-risk: 15 match (archived excluded), only 10 can receive WhatsApp (consent + phone)');
select throws_ok(format($$ select * from core.preview_segment(%L, '{"sql":"drop table x"}') $$, :'biz'),
  '22023', null, 'unknown segment keys are rejected');
select throws_ok(format($$ select * from core.preview_segment(%L, '{"statuses":["VIP"]}') $$, :'biz'),
  '22023', null, 'unknown statuses are rejected');

-- Crear y lanzar ----------------------------------------------------------------------
select (core.create_campaign(:'biz', 'recovery', 'Te extrañamos', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}! En {negocio} te esperamos: {beneficio}', '2x1 en porciones', 20, 14)).id as camp \gset
select is((select status from core.campaigns where id = :'camp'), 'draft', 'a campaign starts as a draft');

select tests.authenticate_as(:'other');
select throws_ok(
  format($$ select core.create_campaign(%L, 'recovery', 'x', '{}', 'Hola hola') $$, :'biz'),
  '42501', null, 'another business cannot create campaigns for me');

reset role;
update core.business_modules set enabled = false where business_id = :'biz' and module_id = 'recovery';
select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ select core.create_campaign(%L, 'recovery', 'x', '{}', 'Hola hola') $$, :'biz'),
  '42501', 'module_disabled', 'the creating module must be enabled');
reset role;
update core.business_modules set enabled = true where business_id = :'biz' and module_id = 'recovery';

select tests.authenticate_as(:'owner');
select is((core.launch_campaign(:'camp')).recipients_count, 10, 'launching freezes the 10 reachable customers');
select is((select count(*)::int from core.campaign_recipients where campaign_id = :'camp' and is_control), 2,
  '20% control group: 2 customers chosen at random are NOT contacted');
select is_empty(
  format($$ select 1 from core.campaign_recipients where campaign_id = %L
            and ((is_control and message is not null) or (not is_control and (message like '%%{%%' or message not like 'Hola Cliente%%2x1 en porciones'))) $$, :'camp'),
  'each contacted customer gets a personalized message; the control group gets none');
select throws_ok(format($$ select core.launch_campaign(%L) $$, :'camp'), '22023', 'campaign_not_draft',
  'a campaign is launched only once');
select throws_ok(format($$ select core.cancel_campaign(%L) $$, :'camp'), '22023', 'campaign_not_draft',
  'a sent campaign cannot be cancelled');

select tests.authenticate_as(:'staff');
select is_empty(format($$ select 1 from core.campaigns where business_id = %L $$, :'biz'),
  'staff cannot see campaigns');

-- Contactar --------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select id as t1 from core.campaign_recipients where campaign_id = :'camp' and not is_control order by id limit 1 \gset
select id as c1 from core.campaign_recipients where campaign_id = :'camp' and is_control limit 1 \gset
select isnt((core.mark_recipient_contacted(:'t1')).contacted_at, null, 'the owner marks a message as sent');
select throws_ok(format($$ select core.mark_recipient_contacted(%L) $$, :'c1'), '22023', 'control_group',
  'control customers cannot be contacted');

-- Resultados -------------------------------------------------------------------------
reset role;
update core.campaigns set sent_at = now() - interval '2 days' where id = :'camp';
create temp table treated as
select customer_id, row_number() over (order by id) as n
  from core.campaign_recipients where campaign_id = :'camp' and not is_control;
grant select on treated to public;
select tests.authenticate_as(:'owner');
select core.record_visit(:'biz', null, customer_id, 100000, now() - interval '1 hour')
  from treated where n <= 3;
select core.record_visit(:'biz', null, customer_id, 100000, now() - interval '3 days')
  from treated where n = 4;

select results_eq(
  format($$ select treatment_count, control_count, contacted_count, treatment_returned, control_returned,
                   treatment_revenue_minor, incremental_customers, incremental_revenue_minor
              from core.campaign_results(%L) $$, :'camp'),
  $$ values (8, 2, 1, 3, 0, 300000::bigint, 3.0::numeric, 300000::bigint) $$,
  '3 of 8 came back (none of the control group): 3 incremental customers, $3.000 incremental');
select ok((select window_open from core.campaign_results(:'camp')), 'the 14-day window is still open');

select id as v_back from core.visits
 where customer_id = (select customer_id from treated where n = 1) and amount_minor = 100000
 order by occurred_at desc limit 1 \gset
select core.void_visit(:'v_back', 'Error de carga');
select is((select treatment_returned from core.campaign_results(:'camp')), 2,
  'a voided visit stops counting as a return');
select is(
  (select count(*)::int from core.list_campaign_recipients(:'camp') where returned_at is not null), 2,
  'the recipients list shows who came back');

-- Tablero ----------------------------------------------------------------------------
select ok((core.dashboard_summary(:'biz')) ? 'visits' and ((core.dashboard_summary(:'biz')) ->> 'visits')::int >= 2,
  'the owner sees the dashboard with this month''s visits');
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.dashboard_summary(%L) $$, :'biz'), '42501', null,
  'staff cannot see the money dashboard');

select * from finish();
rollback;
