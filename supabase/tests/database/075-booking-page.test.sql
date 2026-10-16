-- "Mi página" (D-057): lo que el negocio personaliza llega a la página pública.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('barbero@test.local') as staff \gset
select tests.create_business('barber-page', :'owner') as biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.authenticate_as(:'owner');
insert into booking.settings (business_id, enabled, headline, about, address, instagram, whatsapp)
values (:'biz', true, 'Tu barbería de siempre', 'Cortes clásicos desde 1998.', 'Av. Siempreviva 742',
        'barberiasol', '+5491128330853');
insert into booking.services (business_id, name, duration_minutes, description)
values (:'biz', 'Corte', 30, 'Con lavado y peinado');
insert into booking.staff (business_id, name, bio, photo_path)
values (:'biz', 'Lucho', 'Especialista en fade', :'biz' || '/staff-1.webp') returning id as lucho \gset
insert into booking.staff (business_id, name, active) values (:'biz', 'Ex', false) returning id as ex \gset
insert into booking.hours (business_id, staff_id, weekday, start_time, end_time) values
  (:'biz', :'lucho', 2, '10:00', '13:00'),
  (:'biz', :'lucho', 2, '15:00', '20:00'),
  (:'biz', :'ex', 3, '08:00', '09:00');

select tests.authenticate_as_anon();
select booking.get_public_page('barber-page') as page \gset
select is((:'page'::jsonb)->>'headline', 'Tu barbería de siempre', 'the headline is public');
select is((:'page'::jsonb)->>'instagram', 'barberiasol', 'the instagram is public');
select is((:'page'::jsonb)->'services'->0->>'description', 'Con lavado y peinado',
  'services show their description');
select is((:'page'::jsonb)->'staff'->0->>'bio', 'Especialista en fade', 'staff show their bio');
select is((:'page'::jsonb)->'hours', '[{"weekday": 2, "opens": "10:00", "closes": "20:00"}]'::jsonb,
  'hours span the day and skip inactive staff');
reset role;

select tests.authenticate_as(:'owner');
update booking.settings set show_hours = false where business_id = :'biz';
select is(booking.get_public_page('barber-page')->'hours', '[]'::jsonb, 'hours can be hidden');
select throws_ok(format($$ update booking.settings set instagram = 'no válido!' where business_id = %L $$, :'biz'),
  '23514', null, 'a bad instagram is rejected');

select tests.authenticate_as(:'staff');
update booking.settings set headline = 'Hackeado' where business_id = :'biz';
reset role;
select is((select headline from booking.settings where business_id = :'biz'), 'Tu barbería de siempre',
  'staff cannot change the page');

select * from finish();
rollback;
