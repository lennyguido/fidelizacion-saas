-- Carteles NFC/QR de reseñas (D-048): crear, destino por defecto, roles,
-- aislamiento, toques y estadísticas, cartel apagado.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('cafe-sol', :'owner') as biz \gset
select tests.create_business('otro-cafe', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
insert into core.business_modules (business_id, module_id)
values (:'biz', 'reputation'), (:'other_biz', 'reputation') on conflict do nothing;
update core.businesses set google_review_url = 'https://g.page/r/cafe-sol/review' where id = :'biz';

select tests.authenticate_as(:'staff');
select throws_ok(format($$ select reputation.create_tag(%L, 'Mostrador') $$, :'biz'),
  '42501', null, 'staff cannot create tags');

select tests.authenticate_as(:'owner');
select (reputation.create_tag(:'biz', 'Mostrador')).code as code \gset
select ok(:'code' ~ '^[a-z0-9]{8}$', 'the tag gets an 8-character code');
select is((select destination from reputation.tags where code = :'code'),
  'https://g.page/r/cafe-sol/review', 'by default it points to the Google review link');
select throws_ok(
  format($$ select reputation.create_tag(%L, 'Mesa', 'http://inseguro.com') $$, :'biz'),
  '23514', null, 'only https destinations');

select tests.authenticate_as(:'other');
select is_empty(format($$ select 1 from reputation.tags where business_id = %L $$, :'biz'),
  'another business cannot see the tags');
select throws_ok(format($$ select reputation.tag_stats(%L) $$, :'biz'),
  '42501', null, 'another business cannot see the stats');

-- Toques (los hace la Edge Function con service_role).
reset role;
set local role service_role;
select is(reputation.resolve_tap(:'code', 'nfc'), 'https://g.page/r/cafe-sol/review',
  'a tap redirects to the destination');
select is(reputation.resolve_tap(upper(:'code'), 'qr'), 'https://g.page/r/cafe-sol/review',
  'the code is case-insensitive');
select is(reputation.resolve_tap('noexiste', 'nfc'), null, 'an unknown code returns null');
reset role;

select tests.authenticate_as(:'staff');
select results_eq(
  format($$ select taps_this_month::int, taps_total::int from reputation.tag_stats(%L) $$, :'biz'),
  $$ values (2, 2) $$, 'staff sees the taps of the month');
select throws_ok($$ select count(*) from reputation.taps $$, '42501', null,
  'nobody reads raw taps directly');

select tests.authenticate_as(:'owner');
select id as tag_id from reputation.tags where code = :'code' \gset
select is((reputation.update_tag(:'tag_id', null, 'https://instagram.com/cafesol', null)).destination,
  'https://instagram.com/cafesol', 'the destination changes without reprinting');
select reputation.update_tag(:'tag_id', null, null, false);
reset role;
set local role service_role;
select is(reputation.resolve_tap(:'code', 'nfc'), null, 'a turned-off tag does not redirect');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$ select reputation.resolve_tap('x', 'nfc') $$, '42501', null,
  'anon cannot register taps directly');

select * from finish();
rollback;
