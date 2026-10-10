-- Campañas: atribución por cupón (D-026). Cupón para el grupo contactado,
-- {cupon} en el mensaje, validación en el mostrador, un solo uso, ventana,
-- clientes inactivos, aislamiento entre negocios y conteo en resultados.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('panaderia', :'owner') as biz \gset
select tests.create_business('otra', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');

-- 4 clientes en riesgo con teléfono y WhatsApp aceptado.
insert into core.customers (business_id, name, phone)
select :'biz', 'Cliente ' || g, '+54911300000' || g from generate_series(1, 4) g;
update core.customer_stats s set status = 'AT_RISK'
  from core.customers c where s.customer_id = c.id and c.business_id = :'biz';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '10 days'
  from core.customers c where c.business_id = :'biz';

-- 25% de control: 1 control y 3 contactados.
select tests.authenticate_as(:'owner');
select (core.create_campaign(:'biz', 'recovery', 'Volvé', '{"statuses":["AT_RISK"]}',
        'Hola {nombre}, mostrá el cupón {cupon}: {beneficio}', 'Café gratis', 25, 14)).id as camp \gset
select core.launch_campaign(:'camp');

reset role;
-- Dentro de una transacción now() no avanza: el lanzamiento se corre a ayer para
-- que las visitas de "hoy" queden después del envío.
update core.campaigns set sent_at = now() - interval '1 day' where id = :'camp';

select is(
  (select count(*)::int from core.campaign_recipients
    where campaign_id = :'camp' and not is_control and coupon_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  3, 'every contacted recipient gets a 6-character coupon');
select is(
  (select count(*)::int from core.campaign_recipients
    where campaign_id = :'camp' and is_control and coupon_code is null),
  1, 'the control group gets no coupon');
select is(
  (select count(*)::int from core.campaign_recipients
    where campaign_id = :'camp' and not is_control and position(coupon_code in message) > 0),
  3, '{cupon} is replaced by each recipient''s own code');

select r.coupon_code as code1, r.customer_id as cust1, r.id as rec1
  from core.campaign_recipients r
 where r.campaign_id = :'camp' and not r.is_control order by r.coupon_code limit 1 \gset
select r.coupon_code as code2, r.customer_id as cust2
  from core.campaign_recipients r
 where r.campaign_id = :'camp' and not r.is_control order by r.coupon_code offset 1 limit 1 \gset
select r.coupon_code as code3, r.customer_id as cust3
  from core.campaign_recipients r
 where r.campaign_id = :'camp' and not r.is_control order by r.coupon_code offset 2 limit 1 \gset

-- Validar en el mostrador ---------------------------------------------------------------
select tests.authenticate_as(:'staff');
select is(
  core.find_campaign_coupon(:'biz', :'code1') ->> 'status', 'valid',
  'staff can look up a valid coupon');
select is(
  core.find_campaign_coupon(:'biz', lower(substr(:'code1', 1, 3)) || '-' || lower(substr(:'code1', 4))) ->> 'code',
  :'code1', 'lookup ignores case, spaces and dashes');
select ok(core.find_campaign_coupon(:'biz', 'ZZZZZZ') is null, 'an unknown coupon returns null');

select tests.authenticate_as(:'other');
select throws_ok(format($$ select core.find_campaign_coupon(%L, %L) $$, :'biz', :'code1'),
  '42501', null, 'another business cannot look up my coupons');

-- Usar -------------------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'cust2')).id as visit2 \gset

-- La función de dos pasos ya no es del equipo (20261010141212): reset role la
-- prueba como interna, con la sesión del cajero.
reset role;
select throws_ok(format($$ select core.redeem_campaign_coupon(%L, %L, %L) $$, :'biz', :'code1', :'visit2'),
  '22023', 'coupon_visit_mismatch', 'the visit must belong to the coupon''s customer');
select tests.authenticate_as(:'staff');
select core.record_visit_with_coupon(:'biz', :'code1', null, 500000) as used1 \gset
select is(:'used1'::jsonb ->> 'status', 'used',
  'staff records the visit and redeems the coupon in one call');
select :'used1'::jsonb ->> 'visitId' as visit1 \gset
select throws_ok(format($$ select core.record_visit_with_coupon(%L, %L) $$, :'biz', :'code1'),
  '22023', 'coupon_already_used', 'a coupon can be used only once');

reset role;
select results_eq(
  format($$ select coupon_visit_id, coupon_redeemed_by from core.campaign_recipients where id = %L $$, :'rec1'),
  format($$ values (%L::uuid, %L::uuid) $$, :'visit1', :'staff'),
  'the redemption records the visit and who used it');

-- Resultados -----------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select is((select coupons_redeemed from core.campaign_results(:'camp')), 1,
  'results count the redeemed coupon');
select isnt(
  (select coupon_redeemed_at from core.list_campaign_recipients(:'camp') where recipient_id = :'rec1'),
  null, 'the recipients list shows when the coupon was used');

select core.void_visit(:'visit1', 'error de carga');
select is((select coupons_redeemed from core.campaign_results(:'camp')), 0,
  'if the coupon''s visit is voided, it stops counting');

-- Ventana y clientes inactivos ---------------------------------------------------------
reset role;
update core.campaigns set sent_at = now() - interval '30 days' where id = :'camp';
select tests.authenticate_as(:'staff');
select is(core.find_campaign_coupon(:'biz', :'code2') ->> 'status', 'expired',
  'after the window the coupon shows as expired');
select throws_ok(format($$ select core.record_visit_with_coupon(%L, %L) $$, :'biz', :'code2'),
  '22023', 'coupon_expired', 'an expired coupon cannot be used');

reset role;
update core.campaigns set sent_at = now() - interval '1 day' where id = :'camp';
update core.customers set status = 'archived' where id = :'cust3';
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.record_visit_with_coupon(%L, %L) $$, :'biz', :'code3'),
  '22023', 'customer_inactive', 'an archived customer''s coupon cannot be used');

select * from finish();
rollback;
