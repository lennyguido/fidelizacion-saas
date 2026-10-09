-- Datos y marca del negocio ("Mi negocio" en el panel): nombre, color, zona horaria y
-- logo se editan con un UPDATE directo (policy businesses_update, solo owner/admin).
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

select tests.create_user('marca-owner@test.local') as owner \gset
select tests.create_user('marca-admin@test.local') as admin \gset
select tests.create_user('marca-staff@test.local') as staff \gset
select tests.create_user('marca-otro@test.local') as other \gset

-- Los negocios se crean con el trigger de zona horaria apagado: si corriera primero
-- como postgres, Postgres recordaría el permiso durante la transacción y el test no
-- detectaría que falta el GRANT (eso escondió el error hasta el e2e). Se revierte
-- con el rollback del final.
alter table core.businesses disable trigger businesses_validate;
insert into core.businesses (id, name, slug)
values ('a0000000-0000-0000-0000-00000000000a', 'Marca A', 'marca-a'),
       ('b0000000-0000-0000-0000-00000000000b', 'Marca B', 'marca-b');
alter table core.businesses enable trigger businesses_validate;
insert into core.memberships (business_id, user_id, role)
values ('a0000000-0000-0000-0000-00000000000a', :'owner', 'owner'),
       ('a0000000-0000-0000-0000-00000000000a', :'admin', 'admin'),
       ('a0000000-0000-0000-0000-00000000000a', :'staff', 'staff'),
       ('b0000000-0000-0000-0000-00000000000b', :'other', 'owner');

select ok(has_function_privilege('authenticated', 'core.is_valid_timezone(text)', 'execute'),
  'authenticated can run the timezone check used by the business trigger');

-- El dueño cambia nombre, color y zona horaria (dispara la validación de zona horaria).
select tests.authenticate_as(:'owner');
select lives_ok(
  $$ update core.businesses
        set name = 'Heladería A', primary_color = '#b91c1c', timezone = 'America/Montevideo'
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'the owner updates name, color and timezone');
select results_eq(
  $$ select name, primary_color, timezone from core.businesses
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  $$ values ('Heladería A', '#b91c1c', 'America/Montevideo') $$,
  'the branding is saved');
select throws_ok(
  $$ update core.businesses set timezone = 'Mars/Base'
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '22023', null, 'an invalid timezone is rejected');
select throws_ok(
  $$ update core.businesses set primary_color = 'rojo'
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'an invalid color is rejected');
select lives_ok(
  $$ update core.businesses set logo_path = 'a0000000-0000-0000-0000-00000000000a/logo-1.png'
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'the owner saves the logo path');
select throws_ok(
  $$ update core.businesses set status = 'suspended'
      where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'the owner cannot change the business status');

-- Un admin también puede.
select tests.authenticate_as(:'admin');
select results_eq(
  $$ with u as (update core.businesses set timezone = 'America/Argentina/Cordoba' where id = 'a0000000-0000-0000-0000-00000000000a' returning 1)
     select count(*)::int from u $$,
  $$ values (1) $$, 'an admin updates the timezone');

-- Staff no: RLS no le deja ver la fila para editar (0 filas).
select tests.authenticate_as(:'staff');
select results_eq(
  $$ with u as (update core.businesses set name = 'Hackeado' where id = 'a0000000-0000-0000-0000-00000000000a' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$, 'staff cannot edit the business');

-- El dueño de otro negocio tampoco.
select tests.authenticate_as(:'other');
select results_eq(
  $$ with u as (update core.businesses set name = 'Hackeado' where id = 'a0000000-0000-0000-0000-00000000000a' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$, 'another business owner cannot edit it');

select tests.authenticate_as(:'owner');
select is(
  (select name from core.businesses where id = 'a0000000-0000-0000-0000-00000000000a'),
  'Heladería A', 'the name was not changed by others');

select * from finish();
rollback;
