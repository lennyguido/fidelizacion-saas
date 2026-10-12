-- Opiniones y reseñas (D-036): link de Google válido, encuesta desde la tarjeta
-- (una vez por visita de las últimas 48 h), aviso privado con 3 o menos, el link
-- se ofrece a todos, solo dueño/admin ve las opiniones, invitación en la tarjeta.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

select tests.create_user('duena@test.local') as owner \gset
select tests.create_user('cajero@test.local') as staff \gset
select tests.create_user('otra@test.local') as other \gset
select tests.create_business('resto-opina', :'owner') as biz \gset
select tests.create_business('otro-resto', :'other') as other_biz \gset
select tests.add_member(:'biz', :'staff', 'staff');
select tests.create_customer(:'biz', 'Rosa Opina') as rosa \gset
select tests.create_customer(:'biz', 'Tito Viejo') as tito \gset
insert into loyalty.programs (business_id, points_per_visit) values (:'biz', 1);

-- Link de reseñas ---------------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select throws_ok(
  format($$ update core.businesses set google_review_url = 'https://evil.example/review' where id = %L $$, :'biz'),
  '23514', null, 'only Google review links are accepted');
select lives_ok(
  format($$ update core.businesses set google_review_url = 'https://g.page/r/abc123/review' where id = %L $$, :'biz'),
  'the owner saves her Google review link');
select tests.authenticate_as(:'staff');
select is_empty(
  format($$ update core.businesses set google_review_url = null where id = %L returning 1 $$, :'biz'),
  'staff cannot change the review link');

-- Tarjeta y visitas -----------------------------------------------------------------------
select tests.authenticate_as(:'staff');
select (loyalty.enroll_customer(:'rosa')).id as rosa_m \gset
select (loyalty.enroll_customer(:'tito')).id as tito_m \gset
select loyalty.issue_card(:'rosa_m') as token \gset
select loyalty.issue_card(:'tito_m') as tito_token \gset
select tests.authenticate_as_anon();
select is(loyalty.get_card(:'token') -> 'feedback', 'null'::jsonb, 'no survey without a recent visit');
select is(loyalty.get_card(:'token') -> 'referral', 'null'::jsonb, 'no invite code while referrals are off');
select is(loyalty.get_card(:'token') ->> 'reviewUrl', 'https://g.page/r/abc123/review', 'the card has the review link');

select tests.authenticate_as(:'staff');
select (core.record_visit(:'biz', null, :'rosa', null, now() - interval '10 minutes')).id as visit \gset
reset role;
select tests.backfill_visits(:'tito', array[3]);
select id as old_visit from core.visits where customer_id = :'tito' \gset

select tests.authenticate_as_anon();
select is(loyalty.get_card(:'token') -> 'feedback' ->> 'visitId', :'visit',
  'after a visit the card asks how it went');
select is(loyalty.get_card(:'tito_token') -> 'feedback', 'null'::jsonb,
  'visits older than 48 hours are not surveyed');

-- Encuesta ----------------------------------------------------------------------------------
select throws_ok(format($$ select loyalty.submit_feedback(%L, %L, 6) $$, :'token', :'visit'),
  '22023', null, 'ratings go from 1 to 5');
select throws_ok(format($$ select loyalty.submit_feedback(%L, %L, 5) $$, :'tito_token', :'visit'),
  'P0002', null, 'a card can only rate its own visits');
select throws_ok(format($$ select loyalty.submit_feedback(%L, %L, 5) $$, :'tito_token', :'old_visit'),
  'P0002', null, 'visits older than 48 hours cannot be rated');
select throws_ok(format($$ select loyalty.submit_feedback(%L, %L, 5) $$, repeat('0', 64), :'visit'),
  'P0002', null, 'an unknown card cannot rate');

select is(loyalty.submit_feedback(:'token', :'visit', 2, 'Tardaron mucho') ->> 'reviewUrl',
  'https://g.page/r/abc123/review', 'a low rating is still offered the Google link (no filtering)');
select is(loyalty.submit_feedback(:'token', :'visit', 5) ->> 'reviewUrl',
  'https://g.page/r/abc123/review', 'answering twice does not fail...');
select is(loyalty.get_card(:'token') -> 'feedback', 'null'::jsonb, '...and the survey is gone');

reset role;
select results_eq(
  format($$ select rating::int, comment from core.feedback where business_id = %L $$, :'biz'),
  $$ values (2, 'Tardaron mucho'::text) $$,
  'only the first answer is kept');
select is(
  (select count(*)::int from core.events where business_id = :'biz' and type = 'feedback.low'), 1,
  'a rating of 3 or less leaves one private notice for the owner');

-- Quién ve las opiniones -------------------------------------------------------------------
select tests.authenticate_as(:'owner');
select is((select count(*)::int from core.feedback), 1, 'the owner sees the feedback');
select tests.authenticate_as(:'staff');
select is((select count(*)::int from core.feedback), 0, 'staff does not see the feedback');
select tests.authenticate_as(:'other');
select is((select count(*)::int from core.feedback), 0, 'another business does not see it');

select * from finish();
rollback;
