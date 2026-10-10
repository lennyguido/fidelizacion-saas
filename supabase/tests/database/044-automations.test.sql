-- Recuperación automática (D-031): motor diario. Intervalos, consentimiento,
-- idempotencia, cooldown, "una vez por ausencia", cumpleaños en la zona horaria
-- del negocio, grupo de control, aislamiento y automatizaciones apagadas.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_business('cafe-auto', :'owner') as biz \gset
update core.businesses set timezone = 'America/Argentina/Buenos_Aires' where id = :'biz';

insert into core.customers (business_id, name, phone) values
  (:'biz', 'Frecuente',    '+5491140000001'),  -- cada 7 días, hace 15: en riesgo (7 × 2 = 14)
  (:'biz', 'Mensual',      '+5491140000002'),  -- cada 35 días, hace 15: todavía no (70)
  (:'biz', 'DosVisitas',   '+5491140000003'),  -- 2 visitas, hace 31: en riesgo (30 fijos)
  (:'biz', 'DosRecientes', '+5491140000004'),  -- 2 visitas, hace 20: todavía no
  (:'biz', 'SinPermiso',   '+5491140000005'),  -- como Frecuente, sin consentimiento
  (:'biz', 'SeDioDeBaja',  '+5491140000006'),  -- como Frecuente, se dio de baja
  (:'biz', 'SinTelefono',  null),              -- como Frecuente, sin teléfono
  (:'biz', 'Nuevo',        '+5491140000008'),  -- 1 visita hace 11 días: segunda visita
  (:'biz', 'NuevoViejo',   '+5491140000009'),  -- 1 visita hace 60 días: no
  (:'biz', 'Cumple',       '+5491140000010');  -- cumple el 1/1, viene seguido

update core.customer_stats s
   set visit_count = v.n, median_interval_days = v.med,
       last_visit_at = now() - make_interval(days => v.last_days),
       first_visit_at = now() - make_interval(days => v.first_days)
  from (values ('Frecuente', 10, 7.0, 15, 80), ('Mensual', 5, 35.0, 15, 200),
               ('DosVisitas', 2, 10.0, 31, 41), ('DosRecientes', 2, 5.0, 20, 25),
               ('SinPermiso', 10, 7.0, 15, 80), ('SeDioDeBaja', 10, 7.0, 15, 80),
               ('SinTelefono', 10, 7.0, 15, 80), ('Nuevo', 1, null, 11, 11),
               ('NuevoViejo', 1, null, 60, 60), ('Cumple', 5, 100.0, 2, 400))
       as v(name, n, med, last_days, first_days)
  join core.customers c on c.business_id = :'biz' and c.name = v.name
 where s.customer_id = c.id;
update core.customers set birth_day = 1, birth_month = 1 where business_id = :'biz' and name = 'Cumple';

insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '100 days'
  from core.customers c where c.business_id = :'biz' and c.name <> 'SinPermiso';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
select :'biz', c.id, 'whatsapp', 'marketing', false, 'reply_opt_out'
  from core.customers c where c.business_id = :'biz' and c.name = 'SeDioDeBaja';

insert into core.automations (business_id, kind, enabled, days, message, benefit, control_pct, attribution_days)
values (:'biz', 'at_risk', true, 14, 'Hola {nombre}, volvé: {beneficio} con {cupon}', '10%', 0, 14),
       (:'biz', 'second_visit', true, 10, 'Hola {nombre}, volvé: {beneficio} con {cupon}', '10%', 0, 14);

-- Otro negocio con la automatización apagada y uno con el módulo apagado.
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('otro-auto', :'other') as biz_off \gset
select tests.create_business('sin-modulo', :'other') as biz_nomod \gset
insert into core.customers (business_id, name, phone)
values (:'biz_off', 'Frecuente B', '+5491150000001'), (:'biz_nomod', 'Frecuente C', '+5491160000001');
update core.customer_stats s
   set visit_count = 10, median_interval_days = 7, last_visit_at = now() - interval '15 days',
       first_visit_at = now() - interval '80 days'
  from core.customers c where c.id = s.customer_id and c.business_id in (:'biz_off', :'biz_nomod');
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select c.business_id, c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '100 days'
  from core.customers c where c.business_id in (:'biz_off', :'biz_nomod');
insert into core.automations (business_id, kind, enabled, days, message, control_pct)
values (:'biz_off', 'at_risk', false, 14, 'Hola {nombre}', 0),
       (:'biz_nomod', 'at_risk', true, 14, 'Hola {nombre}', 0);
update core.business_modules set enabled = false where business_id = :'biz_nomod' and module_id = 'recovery';

-- Primera corrida -----------------------------------------------------------------------
select is(core.run_automations(now()), 3, 'the first run picks 3 customers');

select results_eq(
  format($$ select c.name from core.campaign_recipients r
              join core.campaigns k on k.id = r.campaign_id
              join core.customers c on c.id = r.customer_id
             where k.business_id = %L and k.automation_kind = 'at_risk' order by c.name $$, :'biz'),
  $$ values ('DosVisitas'::text), ('Frecuente'::text) $$,
  'at risk: usual interval × 2 (7 → 14 days), 30 fixed days with little data');
select results_eq(
  format($$ select c.name from core.campaign_recipients r
              join core.campaigns k on k.id = r.campaign_id
              join core.customers c on c.id = r.customer_id
             where k.business_id = %L and k.automation_kind = 'second_visit' $$, :'biz'),
  $$ values ('Nuevo'::text) $$,
  'second visit: 10 days after the first one (not someone who came once months ago)');
select is_empty(
  format($$ select 1 from core.campaign_recipients r join core.customers c on c.id = r.customer_id
             where r.business_id = %L and c.name in ('SinPermiso', 'SeDioDeBaja', 'SinTelefono') $$, :'biz'),
  'no message without consent, after opting out or without a phone');
select results_eq(
  format($$ select count(*)::int, count(*) filter (where o.status = 'manual' and o.provider = 'manual')::int,
                   count(*) filter (where position(r.coupon_code in o.message) > 0)::int
              from core.outbox o join core.campaign_recipients r on r.id = o.recipient_id
             where o.business_id = %L $$, :'biz'),
  $$ values (3, 3, 3) $$,
  'each contacted customer gets a ready message (manual provider) with their own coupon');
select is(
  (select status from core.campaigns where business_id = :'biz' and automation_kind = 'at_risk'),
  'sent', 'an automatic campaign is a regular sent campaign (results and coupons work the same)');

-- Idempotencia ---------------------------------------------------------------------------
select is(core.run_automations(now()), 0, 'running again the same day does nothing');
select is((select count(*)::int from core.campaign_recipients where business_id = :'biz'), 3,
  'no duplicated recipients');

-- Cooldown y "una vez por ausencia" ------------------------------------------------------
select core.run_automations(now() + interval '20 days');
select results_eq(
  format($$ select c.name from core.campaign_recipients r
              join core.campaigns k on k.id = r.campaign_id
              join core.customers c on c.id = r.customer_id
             where k.business_id = %L and k.sent_at = now() + interval '20 days' order by c.name $$, :'biz'),
  $$ values ('DosRecientes'::text) $$,
  '20 days later: only a new at-risk customer (30-day cooldown for the others)');

select core.run_automations(now() + interval '45 days');
select is_empty(
  format($$ select 1 from core.campaigns
             where business_id = %L and sent_at = now() + interval '45 days' $$, :'biz'),
  'after the cooldown, someone who never came back is not messaged again');

update core.customer_stats s set last_visit_at = now() + interval '46 days', visit_count = 11
  from core.customers c where c.id = s.customer_id and c.business_id = :'biz' and c.name = 'Frecuente';
select core.run_automations(now() + interval '61 days');
select ok(
  exists (select 1 from core.campaign_recipients r
            join core.campaigns k on k.id = r.campaign_id
            join core.customers c on c.id = r.customer_id
           where k.business_id = :'biz' and k.sent_at = now() + interval '61 days' and c.name = 'Frecuente'),
  'after coming back and leaving again, the customer can be messaged again');

-- Cumpleaños en la zona horaria del negocio ---------------------------------------------
update core.automations set enabled = false where business_id = :'biz';
insert into core.automations (business_id, kind, enabled, days, message, control_pct)
values (:'biz', 'birthday', true, 0, 'Feliz cumple {nombre} {cupon}', 0);

select core.run_automations('2027-01-01 02:00:00+00');
select is_empty(
  format($$ select 1 from core.campaigns where business_id = %L and automation_kind = 'birthday' $$, :'biz'),
  'at 02:00 UTC it is still December 31 in Argentina: no birthday yet');
select core.run_automations('2027-01-01 12:00:00+00');
select results_eq(
  format($$ select c.name, k.automation_date from core.campaign_recipients r
              join core.campaigns k on k.id = r.campaign_id
              join core.customers c on c.id = r.customer_id
             where k.business_id = %L and k.automation_kind = 'birthday' $$, :'biz'),
  $$ values ('Cumple'::text, date '2027-01-01') $$,
  'on January 1st (local time) the birthday message is ready');

-- Grupo de control -----------------------------------------------------------------------
select tests.create_business('grupo-auto', :'owner') as biz_ctl \gset
insert into core.customers (business_id, name, phone)
select :'biz_ctl', 'Cliente ' || g, '+54911700000' || lpad(g::text, 2, '0') from generate_series(1, 40) g;
update core.customer_stats s
   set visit_count = 10, median_interval_days = 7, last_visit_at = now() - interval '15 days',
       first_visit_at = now() - interval '80 days'
  from core.customers c where c.id = s.customer_id and c.business_id = :'biz_ctl';
insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source, recorded_at)
select :'biz_ctl', c.id, 'whatsapp', 'marketing', true, 'counter', now() - interval '100 days'
  from core.customers c where c.business_id = :'biz_ctl';
insert into core.automations (business_id, kind, enabled, days, message, control_pct)
values (:'biz_ctl', 'at_risk', true, 14, 'Hola {nombre} {cupon}', 50);
select core.run_automations(now());

select ok(
  (select count(*) filter (where is_control) > 0 and count(*) filter (where not is_control) > 0
     from core.campaign_recipients where business_id = :'biz_ctl'),
  'with a 50% control group, some customers are control and some are contacted');
select results_eq(
  format($$ select (select count(*)::int from core.outbox where business_id = %1$L),
                   (select count(*)::int from core.campaign_recipients
                     where business_id = %1$L and not is_control and coupon_code is not null),
                   (select count(*)::int from core.campaign_recipients
                     where business_id = %1$L and is_control and coupon_code is null and message is null) +
                   (select count(*)::int from core.campaign_recipients
                     where business_id = %1$L and not is_control) $$, :'biz_ctl'),
  format($$ select (count(*) filter (where not is_control))::int,
                   (count(*) filter (where not is_control))::int, 40
              from core.campaign_recipients where business_id = %L $$, :'biz_ctl'),
  'control customers get no message nor coupon; only contacted ones go to the outbox');

-- Aislamiento, apagada y sin módulo -------------------------------------------------------
select is_empty(
  format($$ select 1 from core.campaigns where business_id in (%L, %L) $$, :'biz_off', :'biz_nomod'),
  'a disabled automation, or a business without the recovery module, sends nothing');

select * from finish();
rollback;
