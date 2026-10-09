-- Fidelización: tarjeta digital por link secreto y código de socio.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('libreria', :'owner') as biz \gset
select tests.create_business('otra', :'other') as biz2 \gset
select tests.add_member(:'biz', :'staff', 'staff');
insert into core.customers (business_id, name, phone, email)
values (:'biz', 'Rosa María Pérez', '+5491144445555', 'rosa@mail.com') returning id as rosa \gset
insert into loyalty.programs (business_id) values (:'biz');
insert into loyalty.rewards (business_id, name, cost_points) values (:'biz', 'Señalador', 2);

select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'rosa')).id as rosa_m \gset
select member_code as code from loyalty.members where id = :'rosa_m' \gset
select ok(:'code' ~ '^[A-Z2-9]{8}$', 'every member gets an 8-character member code');
select throws_ok(
  format($$ select token_hash from loyalty.cards where member_id = %L $$, :'rosa_m'),
  '42501', null, 'the card secret hash is not readable through the API');

select loyalty.issue_card(:'rosa_m') as token \gset
select ok(:'token' ~ '^[0-9a-f]{64}$', 'the card link code is long and random');
select core.record_visit(:'biz', null, :'rosa', null, now() - interval '10 minutes');

-- Sin sesión, con el link --------------------------------------------------------
select tests.authenticate_as_anon();
select is((loyalty.get_card(:'token')) ->> 'firstName', 'Rosa', 'the card shows only the first name');
select is(((loyalty.get_card(:'token')) ->> 'pointsBalance')::int, 1, 'the card shows the balance');
select is((loyalty.get_card(:'token')) ->> 'memberCode', :'code', 'the card shows the member code (for the QR)');
select is(jsonb_array_length((loyalty.get_card(:'token')) -> 'rewards'), 1, 'the card lists the active rewards');
select is(jsonb_array_length((loyalty.get_card(:'token')) -> 'movements'), 1, 'the card shows recent movements');
select ok((loyalty.get_card(:'token'))::text !~ '(5491144445555|rosa@mail.com|Pérez)',
  'the card never includes phone, email or last name');
select is(loyalty.get_card(repeat('0', 64)), null, 'a wrong code shows nothing');
select is(loyalty.get_card('not-a-token'), null, 'a malformed code shows nothing');
select throws_ok(format($$ select loyalty.find_member_by_code(%L, %L) $$, :'biz', :'code'),
  '42501', null, 'anon cannot look up members');

-- Regenerar invalida el link anterior; salir del programa también ------------------
select tests.authenticate_as(:'staff');
select loyalty.issue_card(:'rosa_m') as token2 \gset
select tests.authenticate_as_anon();
select is(loyalty.get_card(:'token'), null, 'issuing a new link invalidates the old one');

-- Buscar por código en el mostrador -------------------------------------------------
select tests.authenticate_as(:'staff');
select is(loyalty.find_member_by_code(:'biz', lower(:'code')), :'rosa'::uuid,
  'the cashier finds the customer by member code (case-insensitive)');
select tests.authenticate_as(:'other');
select throws_ok(format($$ select loyalty.find_member_by_code(%L, %L) $$, :'biz', :'code'),
  '42501', null, 'another business cannot look up my members');

select tests.authenticate_as(:'staff');
select loyalty.leave_program(:'rosa_m');
select tests.authenticate_as_anon();
select is(loyalty.get_card(:'token2'), null, 'the card stops working when the member leaves');

select * from finish();
rollback;
