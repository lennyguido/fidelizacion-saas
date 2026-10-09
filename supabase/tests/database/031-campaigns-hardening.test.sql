-- Campañas (ajustes): baja después de lanzar, campañas superpuestas, "nuevos" del
-- tablero, desempate de consentimientos y números del segmento.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_business('heladeria', :'owner') as biz \gset

-- 6 clientes en riesgo con teléfono y WhatsApp aceptado hace 10 días.
create temp table seeds as
select g, 'Cliente ' || g as name, '+54911100000' || lpad(g::text, 2, '0') as phone
  from generate_series(1, 6) g;
insert into core.customers (business_id, name, phone) select :'biz', name, phone from seeds;
update core.customer_stats s set status = 'AT_RISK'
  from core.customers c where s.customer_id = c.id and c.business_id = :'biz';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '10 days'
  from core.customers c where c.business_id = :'biz';

-- Campaña A sin grupo de control: los 6 quedan para contactar.
select tests.authenticate_as(:'owner');
select (core.create_campaign(:'biz', 'recovery', 'A', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}, te esperamos', null, 0, 14)).id as camp_a \gset
select is((core.launch_campaign(:'camp_a')).recipients_count, 6, 'campaign A freezes 6 recipients');

-- Baja después de lanzar --------------------------------------------------------------
reset role;
select r.id as rev_rec, r.customer_id as rev_cust
  from core.campaign_recipients r join core.customers c on c.id = r.customer_id
 where r.campaign_id = :'camp_a' and c.name = 'Cliente 1' \gset
select r.id as arch_rec
  from core.campaign_recipients r join core.customers c on c.id = r.customer_id
 where r.campaign_id = :'camp_a' and c.name = 'Cliente 2' \gset
select r.id as ok_rec
  from core.campaign_recipients r join core.customers c on c.id = r.customer_id
 where r.campaign_id = :'camp_a' and c.name = 'Cliente 3' \gset
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
values (:'biz', :'rev_cust', 'whatsapp', 'marketing', false, 'reply_opt_out');
update core.customers set status = 'archived' where business_id = :'biz' and name = 'Cliente 2';

select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select phone, message, blocked_reason from core.list_campaign_recipients(%L)
             where recipient_id = %L $$, :'camp_a', :'rev_rec'),
  $$ values (null::text, null::text, 'consent_revoked'::text) $$,
  'opted out after launch: no phone, no message, blocked as consent_revoked');
select results_eq(
  format($$ select phone, message, blocked_reason from core.list_campaign_recipients(%L)
             where recipient_id = %L $$, :'camp_a', :'arch_rec'),
  $$ values (null::text, null::text, 'customer_inactive'::text) $$,
  'archived after launch: no phone, no message, blocked as customer_inactive');
select results_eq(
  format($$ select phone is not null, message is not null, blocked_reason
              from core.list_campaign_recipients(%L) where recipient_id = %L $$, :'camp_a', :'ok_rec'),
  $$ values (true, true, null::text) $$,
  'a customer who still accepts WhatsApp keeps phone and message');
select throws_ok(format($$ select core.mark_recipient_contacted(%L) $$, :'rev_rec'),
  '22023', 'consent_revoked', 'cannot mark as contacted someone who opted out');
select throws_ok(format($$ select core.mark_recipient_contacted(%L) $$, :'arch_rec'),
  '22023', 'consent_revoked', 'cannot mark as contacted an archived customer');
select isnt((core.mark_recipient_contacted(:'ok_rec')).contacted_at, null,
  'a customer with consent can still be marked as contacted');

-- Campañas superpuestas ---------------------------------------------------------------
reset role;
insert into core.customers (business_id, name, phone)
select :'biz', 'Nuevo ' || g, '+54911200000' || g from generate_series(1, 3) g;
update core.customer_stats s set status = 'AT_RISK'
  from core.customers c where s.customer_id = c.id and c.name like 'Nuevo %';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '1 day'
  from core.customers c where c.name like 'Nuevo %';

-- Entran 8 (5 de antes activos + 3 nuevos). Reciben: los 3 nuevos. Ocupados en A: 4
-- (Cliente 1 se dio de baja: no cuenta como alcanzable).
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select matching, reachable, busy from core.preview_segment(%L, '{"statuses":["AT_RISK"]}') $$, :'biz'),
  $$ values (8, 3, 4) $$,
  'preview reports customers already in an open campaign as busy');
select (core.create_campaign(:'biz', 'recovery', 'B', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}, volvé', null, 0, 14)).id as camp_b \gset
select is((core.launch_campaign(:'camp_b')).recipients_count, 3,
  'launching B leaves out customers who are in campaign A');
select is_empty(
  format($$ select 1 from core.campaign_recipients b join core.campaign_recipients a
             on a.customer_id = b.customer_id and a.campaign_id = %L
            where b.campaign_id = %L $$, :'camp_a', :'camp_b'),
  'nobody is in both campaigns at the same time');

-- Al cerrarse la ventana de A, sus clientes vuelven a estar disponibles.
reset role;
update core.campaigns set sent_at = now() - interval '30 days' where id = :'camp_a';
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select matching, reachable, busy from core.preview_segment(%L, '{"statuses":["AT_RISK"]}') $$, :'biz'),
  $$ values (8, 4, 3) $$,
  'after A''s window closes its customers are free again; B''s are busy');

-- Control también cuenta como ocupado.
reset role;
update core.campaigns set sent_at = now() - interval '30 days' where id = :'camp_b';
select tests.authenticate_as(:'owner');
select (core.create_campaign(:'biz', 'recovery', 'C', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}, te extrañamos', null, 50, 14)).id as camp_c \gset
select is((core.launch_campaign(:'camp_c')).recipients_count, 7, 'campaign C takes the 7 reachable');
select results_eq(
  format($$ select reachable, busy from core.preview_segment(%L, '{"statuses":["AT_RISK"]}') $$, :'biz'),
  $$ values (0, 7) $$,
  'both contacted and control customers of C count as busy');

-- Tablero: nuevos -----------------------------------------------------------------------
select is(((core.dashboard_summary(:'biz')) ->> 'newCustomers')::int, 0,
  'customers created/imported this month without visits are not "new"');
reset role;
select customer_id as first_cust from core.campaign_recipients where id = :'ok_rec' \gset
select tests.authenticate_as(:'owner');
select core.record_visit(:'biz', null, :'first_cust', 50000);
select is(((core.dashboard_summary(:'biz')) ->> 'newCustomers')::int, 1,
  'a customer whose first visit is this month counts as new');
reset role;
-- Un cliente con primera visita este mes pero archivado no cuenta.
update core.customers set status = 'archived' where id = :'first_cust';
select tests.authenticate_as(:'owner');
select is(((core.dashboard_summary(:'biz')) ->> 'newCustomers')::int, 0,
  'archived customers are not counted as new');

-- Consentimiento: mismo instante, gana el último registrado ------------------------------
reset role;
select tests.create_customer(:'biz', 'Indecisa') as undecided \gset
update core.customers set phone = '+5491130000001' where id = :'undecided';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
values (:'biz', :'undecided', 'whatsapp', 'marketing', true, 'counter');
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
values (:'biz', :'undecided', 'whatsapp', 'marketing', false, 'reply_opt_out');
select is(
  (select count(distinct recorded_at)::int from core.customer_consents where customer_id = :'undecided'), 1,
  'grant and revoke were recorded at the same instant');
select tests.authenticate_as(:'owner');
select is(
  (select granted from core.customer_consent_status where customer_id = :'undecided'), false,
  'same-transaction grant then revoke resolves to revoked in the status view');
select ok(
  not exists (select 1 from core.preview_segment(:'biz', '{}') p where p.reachable > 0),
  'the customer who revoked in the same transaction cannot be reached');

-- Números del segmento -------------------------------------------------------------------
select throws_ok(format($$ select * from core.preview_segment(%L, '{"min_visits": 2.5}') $$, :'biz'),
  '22023', null, 'non-integer segment numbers are rejected');
select throws_ok(format($$ select * from core.preview_segment(%L, '{"min_days_since_visit": 99999999999}') $$, :'biz'),
  '22023', null, 'huge segment numbers are rejected');
select lives_ok(format($$ select * from core.preview_segment(%L, '{"min_visits": 2.0}') $$, :'biz'),
  'a whole number written as 2.0 is accepted');

select * from finish();
rollback;
