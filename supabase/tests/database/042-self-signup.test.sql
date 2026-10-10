-- Alta del cliente por QR (autoregistro): función pública loyalty.self_signup.
begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('cafe-alta', :'owner') as biz \gset
select tests.create_business('otro-alta', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');
insert into loyalty.programs (business_id, kind) values (:'biz', 'stamps');

-- Una clienta que ya existía: con puntos y sin consentimiento de WhatsApp.
insert into core.customers (business_id, name, phone)
values (:'biz', 'Rosa Pérez', '+5491144445555') returning id as rosa \gset
insert into loyalty.members (business_id, customer_id, points_balance, lifetime_points)
values (:'biz', :'rosa', 7, 7) returning id as rosa_m \gset

-- Configuración: solo dueño/admin ---------------------------------------------------
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.set_self_signup(%L, true) $$, :'biz'),
  '42501', null, 'staff cannot turn on the QR sign-up');
select tests.authenticate_as(:'owner');
select is((select count(*)::int from core.self_signup_settings where business_id = :'biz'), 0,
  'the QR sign-up is off by default (no settings row)');
select (core.set_self_signup(:'biz', true)).code as code \gset
select ok(:'code' ~ '^[A-HJ-NP-Z2-9]{10}$', 'turning it on creates a random 10-character public code');
select tests.authenticate_as(:'staff');
select throws_ok(format($$ select core.rotate_self_signup_code(%L) $$, :'biz'),
  '42501', null, 'staff cannot change the public code');
select is((select code from core.self_signup_settings where business_id = :'biz'), :'code',
  'the team can read the code (it is printed on the poster)');

-- Sin sesión ---------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(format($$ select core.self_signup_customer(%L, 'X', '+5491100000000', true, true) $$, :'biz'),
  '42501', null, 'anon cannot call the internal core function');
select throws_ok($$ select * from core.self_signup_settings $$,
  '42501', null, 'anon cannot read the sign-up settings');

select loyalty.self_signup(:'code', '  Ana   López ', '+5491155550001', true, true) as r1 \gset
select is(:'r1'::jsonb ->> 'status', 'created', 'a new customer signs up');
select ok((:'r1'::jsonb ->> 'token') ~ '^[0-9a-f]{64}$', 'and receives the secret card link once');
select is((loyalty.get_card(:'r1'::jsonb ->> 'token')) ->> 'firstName', 'Ana', 'the link opens the new card');
select is(((loyalty.get_card(:'r1'::jsonb ->> 'token')) ->> 'pointsBalance')::int, 0,
  'signing up gives no points');

reset role;
select id as ana from core.customers where business_id = :'biz' and phone = '+5491155550001' \gset
select results_eq(
  format($$ select name, source, status from core.customers where id = %L $$, :'ana'),
  $$ values ('Ana López'::text, 'qr'::text, 'active'::text) $$,
  'the customer is created with a clean name and source qr');
select results_eq(
  format($$ select channel, purpose, granted, source from core.customer_consents where customer_id = %L $$, :'ana'),
  $$ values ('whatsapp'::text, 'marketing'::text, true, 'self_signup'::text) $$,
  'the WhatsApp consent is recorded with source self_signup');
select is((select status from loyalty.members where customer_id = :'ana'), 'active', 'she is a member of the program');
select is((select count(*)::int from loyalty.ledger l join loyalty.members m on m.id = l.member_id
            where m.customer_id = :'ana'), 0, 'no ledger movement for signing up');
select results_eq(
  format($$ select outcome, whatsapp_opt_in from core.self_signups where customer_id = %L $$, :'ana'),
  $$ values ('created'::text, true) $$,
  'the sign-up is logged');

select tests.authenticate_as_anon();
select is(loyalty.self_signup(lower(:'code'), 'Beto', '+5491155550002', true, false) ->> 'status', 'created',
  'the code is case-insensitive');
reset role;
select is((select granted from core.customer_consents c join core.customers cu on cu.id = c.customer_id
            where cu.phone = '+5491155550002'), false,
  'not ticking WhatsApp records a refusal (no messages)');

-- Validaciones -----------------------------------------------------------------------
select tests.authenticate_as_anon();
select is(loyalty.self_signup('ZZZZZZZZZZ', 'Caro', '+5491155550003', true, true), '{"status": "unavailable"}'::jsonb,
  'an unknown code is unavailable');
select is(loyalty.self_signup(:'code', 'Caro', '+5491155550003', false, true) ->> 'status', 'terms_required',
  'the terms are required');
select is(loyalty.self_signup(:'code', 'C', '+5491155550003', true, true) ->> 'status', 'invalid_name',
  'a too-short name is rejected');
select is(loyalty.self_signup(:'code', repeat('x', 61), '+5491155550003', true, true) ->> 'status', 'invalid_name',
  'a too-long name is rejected');
select is(loyalty.self_signup(:'code', 'Caro', '11 5555-0003', true, true) ->> 'status', 'invalid_phone',
  'the phone must be E.164 (normalized by the app)');
reset role;
select is((select count(*)::int from core.customers where phone = '+5491155550003'), 0,
  'rejected sign-ups create nothing');

-- Teléfono que ya existía: no filtra nada, no cambia nada, deja un aviso ------------
select tests.authenticate_as_anon();
select is(loyalty.self_signup(:'code', 'Rosa Impostora', '+5491144445555', true, true),
  '{"status": "existing"}'::jsonb,
  'an existing phone gets a generic answer: no card link, no points, no name');
reset role;
select is((select count(*)::int from core.customer_consents where customer_id = :'rosa'), 0,
  'the existing customer''s consent is NOT changed from an anonymous call');
select results_eq(
  format($$ select name, points_balance from core.customers c join loyalty.members m on m.customer_id = c.id
             where c.id = %L $$, :'rosa'),
  $$ values ('Rosa Pérez'::text, 7::bigint) $$,
  'the existing customer and her card are untouched');
select results_eq(
  format($$ select outcome, name_given, whatsapp_opt_in, resolved_at is null from core.self_signups
             where customer_id = %L $$, :'rosa'),
  $$ values ('existing'::text, 'Rosa Impostora'::text, true, true) $$,
  'a notice is left for the team (with the WhatsApp wish, to confirm in person)');
select id as notice from core.self_signups where customer_id = :'rosa' \gset

-- Avisos: el equipo los ve y los resuelve; otro negocio no -------------------------
select tests.authenticate_as(:'other');
select is((select count(*)::int from core.self_signups where business_id = :'biz'), 0,
  'another business cannot see my sign-ups');
select throws_ok(format($$ select core.resolve_self_signup_notice(%L) $$, :'notice'),
  '42501', null, 'another business cannot resolve my notices');
select tests.authenticate_as(:'staff');
select core.resolve_self_signup_notice(:'notice');
select isnt((select resolved_at from core.self_signups where id = :'notice'), null,
  'the cashier resolves the notice');

-- Aislamiento: el código de otro negocio crea el cliente en ese negocio -----------
select tests.authenticate_as(:'other');
select (core.set_self_signup(:'biz2', true)).code as code2 \gset
select tests.authenticate_as_anon();
select loyalty.self_signup(:'code2', 'Rosa', '+5491144445555', true, false) ->> 'status' as r2 \gset
reset role;
select is(:'r2'::text, 'created', 'the same phone in another business is a new customer there');
select is((select business_id from core.customers where phone = '+5491144445555' and id <> :'rosa'),
  :'biz2'::uuid, 'and it belongs to that business only');

-- Apagado, módulo apagado y código cambiado ------------------------------------------
select tests.authenticate_as(:'owner');
select core.set_self_signup(:'biz', false);
select tests.authenticate_as_anon();
select is(loyalty.self_signup(:'code', 'Dani', '+5491155550004', true, true) ->> 'status', 'unavailable',
  'turned off: nobody can sign up');

reset role;
update core.business_modules set enabled = false where business_id = :'biz' and module_id = 'loyalty';
select tests.authenticate_as(:'owner');
select core.set_self_signup(:'biz', true);
select tests.authenticate_as_anon();
select is(loyalty.self_signup(:'code', 'Dani', '+5491155550004', true, true) ->> 'status', 'unavailable',
  'without the loyalty module nobody can sign up');
reset role;
update core.business_modules set enabled = true where business_id = :'biz' and module_id = 'loyalty';

select tests.authenticate_as(:'owner');
select (core.rotate_self_signup_code(:'biz')).code as code3 \gset
select tests.authenticate_as_anon();
select is(loyalty.self_signup(:'code', 'Dani', '+5491155550004', true, true) ->> 'status', 'unavailable',
  'after changing the code the old poster stops working');

-- Límite de intentos: 30 por hora por negocio ----------------------------------------
reset role;
insert into core.self_signups (business_id, customer_id, outcome, name_given, whatsapp_opt_in, terms_accepted_at)
select :'biz', :'rosa', 'existing', 'spam', false, now() from generate_series(1, 30);
select tests.authenticate_as_anon();
select is(loyalty.self_signup(:'code3', 'Eli', '+5491155550005', true, true) ->> 'status', 'rate_limited',
  'more than 30 attempts in an hour are blocked');
reset role;
select is((select count(*)::int from core.customers where phone = '+5491155550005'), 0,
  'a blocked attempt creates nothing');

select * from finish();
rollback;
