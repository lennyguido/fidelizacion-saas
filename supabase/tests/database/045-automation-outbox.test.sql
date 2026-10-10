-- Recuperación automática (D-031): configuración, roles, aislamiento, bandeja de
-- "Mensajes listos" y cumpleaños en la ficha del cliente.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('kiosco-auto', :'owner') as biz \gset
select tests.create_business('otro-kiosco', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

-- 2 clientes en riesgo con WhatsApp aceptado.
insert into core.customers (business_id, name, phone)
values (:'biz', 'Ana', '+5491180000001'), (:'biz', 'Beto', '+5491180000002');
update core.customer_stats s
   set visit_count = 10, median_interval_days = 7, last_visit_at = now() - interval '15 days',
       first_visit_at = now() - interval '80 days'
  from core.customers c where c.id = s.customer_id and c.business_id = :'biz';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '100 days'
  from core.customers c where c.business_id = :'biz';

-- Configuración ---------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select kind, enabled, days from core.list_automations(%L) $$, :'biz'),
  $$ values ('at_risk'::text, false, 14), ('second_visit'::text, false, 10), ('birthday'::text, false, 0) $$,
  'the three automations exist, off by default, with default days');
select ok(
  (select bool_and(position('{cupon}' in message) > 0) from core.list_automations(:'biz')),
  'default messages include the coupon');

select is(
  (core.set_automation(:'biz', 'at_risk', true, 14, 'Hola {nombre}, te esperamos: {cupon}', '10%', 0, 14)).enabled,
  true, 'the owner turns on an automation');
select throws_ok(
  format($$ select core.set_automation(%L, 'at_risk', true, 2, 'Hola {nombre}') $$, :'biz'),
  '22023', null, 'days out of range are rejected');
select throws_ok(
  format($$ select core.set_automation(%L, 'vip', true, 14, 'Hola {nombre}') $$, :'biz'),
  '22023', null, 'unknown automations are rejected');

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select * from core.list_automations(%L) $$, :'biz'),
  '42501', null, 'staff cannot see the automations');
select throws_ok(
  format($$ select core.set_automation(%L, 'at_risk', false, 14, 'Hola {nombre}') $$, :'biz'),
  '42501', null, 'staff cannot change the automations');
select is_empty('select 1 from core.automations', 'staff cannot read the automations table');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from core.list_automations(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my automations');

-- Revisar ahora y bandeja -----------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.run_business_automations(%L) $$, :'biz'),
  '42501', null, 'staff cannot run the automations');

select tests.authenticate_as(:'owner');
select is(core.run_business_automations(:'biz'), 2, '"check now" prepares the messages');
select is(core.run_business_automations(:'biz'), 0, '...and running it again the same day does nothing');

select results_eq(
  format($$ select name, phone is not null, position('te esperamos' in message) > 0, blocked_reason
              from core.list_outbox(%L) order by name $$, :'biz'),
  $$ values ('Ana'::text, true, true, null::text), ('Beto'::text, true, true, null::text) $$,
  'the owner sees the ready messages with phone and text');

select o.outbox_id as ana_msg from core.list_outbox(:'biz') o where o.name = 'Ana' \gset
select o.outbox_id as beto_msg from core.list_outbox(:'biz') o where o.name = 'Beto' \gset

select is((core.mark_outbox_sent(:'ana_msg')).status, 'sent', 'the owner marks a message as sent');
select ok(
  (select r.contacted_at is not null from core.outbox o
     join core.campaign_recipients r on r.id = o.recipient_id where o.id = :'ana_msg'),
  'sending it marks the recipient as contacted (same as manual campaigns)');

-- Baja después de preparar el mensaje: no se puede mandar.
reset role;
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
select :'biz', c.id, 'whatsapp', 'marketing', false, 'reply_opt_out'
  from core.customers c where c.business_id = :'biz' and c.name = 'Beto';
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select phone, message, blocked_reason from core.list_outbox(%L) where outbox_id = %L $$,
         :'biz', :'beto_msg'),
  $$ values (null::text, null::text, 'consent_revoked'::text) $$,
  'after opting out: no phone, no message');
select throws_ok(format($$ select core.mark_outbox_sent(%L) $$, :'beto_msg'),
  '22023', 'consent_revoked', 'a message to someone who opted out cannot be sent');
select is((core.discard_outbox(:'beto_msg')).status, 'failed', 'it can be discarded');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select * from core.list_outbox(%L) $$, :'biz'),
  '42501', null, 'another business cannot see my outbox');

-- Cumpleaños en la ficha ------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(
  format($$ update core.customers set birth_day = 31, birth_month = 2 where business_id = %L and name = 'Ana' $$,
         :'biz'),
  '23514', null, 'February 31st is not a valid birthday');

select * from finish();
rollback;
