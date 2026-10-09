-- Equipo: invitaciones y administración de miembros.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('admin@test.local') as admin \gset
select tests.create_user('cajero@test.local') as cashier \gset
select tests.create_user('otro@test.local') as other \gset
select tests.create_business('heladeria', :'owner') as biz \gset
select tests.add_member(:'biz', :'admin', 'admin');

-- Crear invitaciones ------------------------------------------------------------
select tests.authenticate_as(:'admin');
select throws_ok(
  format($$ select * from core.create_invitation(%L, 'nuevo@test.local', 'admin') $$, :'biz'),
  '42501', null, 'an admin cannot invite another admin');

select tests.authenticate_as(:'owner');
select token as token from core.create_invitation(:'biz', '  CAJERO@test.local ', 'staff') \gset
select is(length(:'token'), 64, 'the invitation code is long and random');
select is(
  (select email from core.invitations where business_id = :'biz' and accepted_at is null and revoked_at is null),
  'cajero@test.local', 'emails are normalized');
select throws_ok(
  format($$ select token_hash from core.invitations where business_id = %L $$, :'biz'),
  '42501', null, 'the code hash is not readable through the API');
select throws_ok(
  format($$ select * from core.create_invitation(%L, 'admin@test.local', 'staff') $$, :'biz'),
  '23505', 'already_member', 'cannot invite someone who is already a member');

-- Reinvitar reemplaza la anterior.
select token as token2 from core.create_invitation(:'biz', 'cajero@test.local', 'staff') \gset
select is(
  (select count(*)::int from core.invitations where business_id = :'biz' and email = 'cajero@test.local' and revoked_at is null),
  1, 're-inviting revokes the previous pending invitation');

-- Aceptar -----------------------------------------------------------------------
select tests.authenticate_as(:'other');
select results_eq(
  format($$ select business_name, role, status from core.get_invitation(%L) $$, :'token2'),
  $$ values ('Test heladeria', 'staff', 'pending') $$,
  'anyone signed in with the link can see what the invitation is');
select throws_ok(
  format($$ select core.accept_invitation(%L) $$, :'token2'),
  '42501', 'invitation_email_mismatch', 'only the invited email can accept');

select tests.authenticate_as(:'cashier');
select throws_ok(
  format($$ select core.accept_invitation(%L) $$, :'token'),
  '22023', 'invitation_unavailable', 'a replaced invitation cannot be used');
select is(
  (core.accept_invitation(:'token2')).slug, 'heladeria',
  'the invited person accepts and gets the business');
select results_eq(
  format($$ select role from core.memberships where business_id = %L and user_id = %L $$, :'biz', :'cashier'),
  $$ values ('staff') $$,
  'the new member has the invited role');
select throws_ok(
  format($$ select core.accept_invitation(%L) $$, :'token2'),
  '22023', 'invitation_unavailable', 'an invitation works only once');
select throws_ok(
  format($$ select * from core.list_members(%L) $$, :'biz'),
  '42501', null, 'staff cannot list the team with emails');

select tests.authenticate_as_anon();
select throws_ok(
  format($$ select * from core.get_invitation(%L) $$, :'token2'),
  '42501', null, 'anon cannot read invitations');

-- Administrar miembros ---------------------------------------------------------
select tests.authenticate_as(:'owner');
select results_eq(
  format($$ select email, role from core.list_members(%L) $$, :'biz'),
  $$ values ('duena@test.local', 'owner'), ('admin@test.local', 'admin'), ('cajero@test.local', 'staff') $$,
  'the owner sees the team with emails, owner first');

select membership_id as cashier_m from core.list_members(:'biz') where email = 'cajero@test.local' \gset
select membership_id as owner_m from core.list_members(:'biz') where email = 'duena@test.local' \gset

select tests.authenticate_as(:'admin');
select throws_ok(
  format($$ select core.update_member(%L, 'admin', 'active') $$, :'cashier_m'),
  '42501', null, 'only the owner manages roles');

select tests.authenticate_as(:'owner');
select lives_ok(
  format($$ select core.update_member(%L, 'staff', 'disabled') $$, :'cashier_m'),
  'the owner can disable a member');

select tests.authenticate_as(:'cashier');
select is_empty(
  format($$ select 1 from core.customers where business_id = %L $$, :'biz'),
  'a disabled member loses access immediately');

-- No quedarse sin dueño (el control se hace al cerrar la transacción).
select tests.authenticate_as(:'owner');
select core.update_member(:'owner_m', 'admin', 'active');
select throws_ok($$ set constraints all immediate $$, '23514', null,
  'the business cannot be left without an active owner');

select * from finish();
rollback;
