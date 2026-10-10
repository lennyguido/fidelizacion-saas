-- Cupones de campaña: endurecimiento (20261010141212). Visita obligatoria y
-- dentro de la ventana, resultados solo con visitas vigentes, una sola llamada
-- en el mostrador (reusa la visita recién cargada), módulo deshabilitado,
-- auto-canje bloqueado y códigos con pgcrypto.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_business('panaderia', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

-- 6 clientes en riesgo con teléfono y WhatsApp aceptado; 20% de control: 1 + 5.
insert into core.customers (business_id, name, phone)
select :'biz', 'Cliente ' || g, '+54911400000' || g from generate_series(1, 6) g;
update core.customer_stats s set status = 'AT_RISK'
  from core.customers c where s.customer_id = c.id and c.business_id = :'biz';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '10 days'
  from core.customers c where c.business_id = :'biz';

select tests.authenticate_as(:'owner');
select (core.create_campaign(:'biz', 'recovery', 'Volvé', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}, tu cupón: {cupon}', 'Café gratis', 20, 14)).id as camp \gset
select core.launch_campaign(:'camp');

reset role;
update core.campaigns set sent_at = now() - interval '1 day' where id = :'camp';

select r.coupon_code as code_a, r.customer_id as cust_a, r.id as rec_a
  from core.campaign_recipients r where r.campaign_id = :'camp' and not r.is_control
 order by r.coupon_code limit 1 \gset
select r.coupon_code as code_b, r.customer_id as cust_b, r.id as rec_b
  from core.campaign_recipients r where r.campaign_id = :'camp' and not r.is_control
 order by r.coupon_code offset 1 limit 1 \gset
select r.coupon_code as code_c, r.customer_id as cust_c, r.id as rec_c
  from core.campaign_recipients r where r.campaign_id = :'camp' and not r.is_control
 order by r.coupon_code offset 2 limit 1 \gset
select r.coupon_code as code_d, r.customer_id as cust_d
  from core.campaign_recipients r where r.campaign_id = :'camp' and not r.is_control
 order by r.coupon_code offset 3 limit 1 \gset
select r.coupon_code as code_e
  from core.campaign_recipients r where r.campaign_id = :'camp' and not r.is_control
 order by r.coupon_code offset 4 limit 1 \gset

-- Códigos con pgcrypto -----------------------------------------------------------------
select ok(core.new_coupon_code(:'biz') ~ '^[A-HJ-NP-Z2-9]{6}$',
  'new codes use the coupon alphabet (pgcrypto bytes)');
select is(
  (select count(distinct coupon_code)::int from core.campaign_recipients
    where campaign_id = :'camp' and not is_control and coupon_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  5, 'every contacted recipient gets its own valid code');

-- Sin visita no hay cupón usado ------------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, null) $$, :'biz', :'code_a'),
  '42501', null, 'staff can no longer call the two-step redeem function');
-- Como interna (sesión del cajero, sin rol de PostgREST):
reset role;
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, null) $$, :'biz', :'code_a'),
  '22023', 'coupon_visit_mismatch', 'a coupon cannot be redeemed without a visit');
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, %L) $$, :'biz', :'code_a', gen_random_uuid()),
  '22023', 'coupon_visit_mismatch', 'a coupon cannot be redeemed with a visit that does not exist');
select throws_ok(
  format($$ update core.campaign_recipients set coupon_redeemed_at = now() where id = %L $$, :'rec_a'),
  '23514', null, 'the table rejects a used coupon without a visit');

-- Visita fuera de la ventana ---------------------------------------------------------
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'cust_a', null, now() - interval '2 days')).id as before_send \gset
reset role;
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, %L) $$, :'biz', :'code_a', :'before_send'),
  '22023', 'coupon_visit_mismatch', 'a visit before the campaign was sent does not count');

-- La ventana termina en 1 minuto; una visita cargada 4 minutos adelante cae afuera.
update core.campaigns set sent_at = now() - interval '14 days' + interval '1 minute' where id = :'camp';
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'cust_a', null, now() + interval '4 minutes')).id as after_window \gset
reset role;
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, %L) $$, :'biz', :'code_a', :'after_window'),
  '22023', 'coupon_visit_mismatch', 'a visit after the campaign window does not count');
update core.campaigns set sent_at = now() - interval '1 day' where id = :'camp';

-- Una sola llamada en el mostrador -------------------------------------------------------
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'cust_b', 1000)).id as visit_b \gset
select core.record_visit_with_coupon(:'biz', :'code_b', null, 2000) as used_b \gset
select is(:'used_b'::jsonb ->> 'visitId', :'visit_b',
  'the coupon reuses the visit recorded a moment ago instead of failing');
select is((:'used_b'::jsonb ->> 'visitReused')::boolean, true, 'the response says the visit was reused');
reset role;
select is(
  (select count(*)::int from core.visits where customer_id = :'cust_b' and voided_at is null), 1,
  'no second visit is recorded for the same customer');

select tests.authenticate_as(:'staff');
select core.record_visit_with_coupon(:'biz', lower(:'code_c'), null, 2000) as used_c \gset
select is((:'used_c'::jsonb ->> 'visitReused')::boolean, false,
  'without a recent visit a new one is recorded');
select is(:'used_c'::jsonb ->> 'customerName', (select name from core.customers where id = :'cust_c'),
  'the response includes the customer name');
select is(:'used_c'::jsonb ->> 'benefit', 'Café gratis', 'the response includes the benefit');
reset role;
select results_eq(
  format($$ select amount_minor, created_by from core.visits where id = %L $$, :'used_c'::jsonb ->> 'visitId'),
  format($$ values (2000::bigint, %L::uuid) $$, :'staff'),
  'the new visit carries the amount and who recorded it');
select is(
  (select coupon_visit_id::text from core.campaign_recipients where id = :'rec_c'),
  :'used_c'::jsonb ->> 'visitId', 'the coupon is linked to the new visit');

-- Resultados solo con visitas vigentes ------------------------------------------------
select tests.authenticate_as(:'owner');
select is((select coupons_redeemed from core.campaign_results(:'camp')), 2,
  'results count coupons with a valid visit');
select core.void_visit((:'used_c'::jsonb ->> 'visitId')::uuid, 'error de carga');
select is((select coupons_redeemed from core.campaign_results(:'camp')), 1,
  'a coupon whose visit was voided stops counting');

-- Un cupón viejo marcado sin visita (antes de esta migración) no cuenta.
reset role;
alter table core.campaign_recipients drop constraint campaign_recipients_coupon_visit_required;
update core.campaign_recipients set coupon_redeemed_at = now() where id = :'rec_a';
select tests.authenticate_as(:'owner');
select is((select coupons_redeemed from core.campaign_results(:'camp')), 1,
  'a legacy coupon redeemed without a visit does not count');

-- Auto-canje bloqueado ------------------------------------------------------------------
reset role;
insert into core.customer_accounts (business_id, customer_id, user_id) values (:'biz', :'cust_d', :'staff');
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.record_visit_with_coupon(%L, %L) $$, :'biz', :'code_d'),
  '42501', 'self_redemption', 'staff cannot redeem a coupon of a customer linked to their own account');

-- Módulo deshabilitado -----------------------------------------------------------------
reset role;
update core.business_modules set enabled = false where business_id = :'biz' and module_id = 'recovery';
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.find_campaign_coupon(%L, %L) $$, :'biz', :'code_e'),
  '42501', 'module_disabled', 'coupons cannot be looked up when the module is disabled');
select throws_ok(format($$ select core.record_visit_with_coupon(%L, %L) $$, :'biz', :'code_e'),
  '42501', 'module_disabled', 'coupons cannot be used when the module is disabled');

select * from finish();
rollback;
