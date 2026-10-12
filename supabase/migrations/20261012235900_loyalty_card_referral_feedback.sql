-- =============================================================================
-- LOYALTY · Tarjeta del cliente: código para invitar y encuesta "¿Cómo te
-- atendimos?". Plan de Claude Code, tarea 6. D-036.
--
-- *** PENDIENTE DE REVISIÓN DEL MENTOR: NO APLICAR EN SUPABASE HASTA ENTONCES ***
-- Toca funciones que usan personas sin cuenta (anon):
--   * loyalty.get_card: además devuelve
--       - referral: código de invitación y puntos de cada lado (solo si la
--         invitación está prendida en el programa);
--       - feedback: la última visita no anulada de las últimas 48 h que todavía
--         no tiene opinión (null si no hay);
--       - reviewUrl: link de reseñas de Google del negocio (puede ser null).
--   * loyalty.submit_feedback(token, visita, nota, comentario): nueva, anon.
--     Resuelve el token a su cliente y llama a core.record_feedback (interna):
--     solo visitas propias, no anuladas, de las últimas 48 h, una vez por visita.
--     Devuelve el link de Google para ofrecérselo a todos (sin premio ni filtro).
-- Requiere la migración loyalty_referrals_core_feedback (tablas y funciones internas):
-- por eso su número es más alto aunque se aplique después.
-- =============================================================================

create or replace function loyalty.get_card(p_token text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member   loyalty.members;
  v_business core.businesses;
  v_customer core.customers;
  v_program  loyalty.programs;
  v_feedback_visit uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select m.* into v_member
    from loyalty.cards c join loyalty.members m on m.id = c.member_id
   where c.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found or v_member.status <> 'active' or not core.has_module(v_member.business_id, 'loyalty') then
    return null;
  end if;
  select * into v_customer from core.customers
   where id = v_member.customer_id and business_id = v_member.business_id;
  if not found or v_customer.status <> 'active' or v_customer.anonymized_at is not null then
    return null;
  end if;
  select * into v_business from core.businesses where id = v_member.business_id;
  select * into v_program from loyalty.programs where business_id = v_member.business_id;

  select v.id into v_feedback_visit
    from core.visits v
   where v.business_id = v_member.business_id and v.customer_id = v_member.customer_id
     and v.voided_at is null and v.occurred_at > now() - interval '48 hours'
     and not exists (select 1 from core.feedback f
                      where f.business_id = v.business_id and f.visit_id = v.id)
   order by v.occurred_at desc
   limit 1;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'name', v_business.name, 'slug', v_business.slug, 'currency', v_business.currency,
      'primaryColor', v_business.primary_color, 'logoPath', v_business.logo_path),
    'firstName', split_part(btrim(v_customer.name), ' ', 1),
    'memberCode', v_member.member_code,
    'pointsBalance', v_member.points_balance,
    'lifetimePoints', v_member.lifetime_points,
    'joinedAt', v_member.joined_at,
    'program', case when v_program.business_id is null then null else jsonb_build_object(
      'enabled', v_program.enabled, 'kind', v_program.kind,
      'pointsPerVisit', v_program.points_per_visit, 'pointsPerAmount', v_program.points_per_amount,
      'amountStepMinor', v_program.amount_step_minor, 'minAmountMinor', v_program.min_amount_minor) end,
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description,
                                          'costPoints', r.cost_points) order by r.cost_points)
        from loyalty.rewards r
       where r.business_id = v_member.business_id and r.active
         and (r.available_until is null or r.available_until > now())), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'createdAt', l.created_at)
                       order by l.created_at desc, l.id desc)
        from (select * from loyalty.ledger
               where business_id = v_member.business_id and member_id = v_member.id
               order by created_at desc, id desc limit 10) l), '[]'::jsonb),
    'referral', case when v_program.referral_enabled then jsonb_build_object(
      'code', v_member.referral_code,
      'referrerPoints', v_program.referral_points_referrer,
      'friendPoints', v_program.referral_points_friend) end,
    'feedback', case when v_feedback_visit is null then null
                     else jsonb_build_object('visitId', v_feedback_visit) end,
    'reviewUrl', v_business.google_review_url
  );
end;
$$;

create function loyalty.submit_feedback(
  p_token text, p_visit_id uuid, p_rating integer, p_comment text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member   loyalty.members;
  v_customer core.customers;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  select m.* into v_member
    from loyalty.cards c join loyalty.members m on m.id = c.member_id
   where c.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found or v_member.status <> 'active' or not core.has_module(v_member.business_id, 'loyalty') then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  select * into v_customer from core.customers
   where id = v_member.customer_id and business_id = v_member.business_id;
  if not found or v_customer.status <> 'active' or v_customer.anonymized_at is not null then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  return core.record_feedback(v_member.business_id, v_member.customer_id, p_visit_id,
                              p_rating, p_comment);
end;
$$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function
  loyalty.get_card(text),
  loyalty.submit_feedback(text, uuid, integer, text)
to anon;
-- Funciones anon de otras migraciones que pueden estar aplicadas antes o después.
do $$
begin
  if to_regprocedure('loyalty.self_signup(text,text,text,boolean,boolean)') is not null then
    grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
  end if;
  if to_regprocedure('loyalty.request_redemption(text,uuid)') is not null then
    grant execute on function
      loyalty.request_redemption(text, uuid),
      loyalty.get_redemption_request(text, uuid)
    to anon;
  end if;
end;
$$;
