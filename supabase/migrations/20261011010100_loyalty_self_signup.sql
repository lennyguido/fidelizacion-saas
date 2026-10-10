-- =============================================================================
-- LOYALTY · Alta por QR (tarjeta para el cliente que se anota solo). docs/ALTA-QR.md
-- Las plantillas por rubro están en 20261010184152_loyalty_templates.sql.
--
-- ⚠ REQUIERE REVISIÓN DEL MENTOR ANTES DE APLICAR: loyalty.self_signup es la
--   segunda función ejecutable SIN SESIÓN de la plataforma (la primera es
--   loyalty.get_card, D-020).
--
-- loyalty.self_signup(código del cartel, nombre, celular, términos, whatsapp):
--   * el negocio tiene que tener el alta activada y el módulo loyalty activo;
--   * el cliente y su consentimiento los crea el núcleo (core.self_signup_customer),
--     con un límite de 30 altas/intentos por hora por negocio;
--   * si el cliente es nuevo: lo suma al programa (sin puntos de regalo) y
--     devuelve el link secreto de su tarjeta (D-020) UNA vez;
--   * si el teléfono ya existía: responde solo {status: 'existing'}. Nunca
--     devuelve la tarjeta existente (cualquiera que sepa tu número vería tus
--     puntos) ni cambia nada de esa ficha; el equipo recibe un aviso.
-- Migración no destructiva: solo funciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alta por QR
-- -----------------------------------------------------------------------------

-- Crea el link secreto de la tarjeta (igual que issue_card, sin pedir sesión).
-- INTERNA: solo la usa self_signup.
create function loyalty.create_card(p_member loyalty.members) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into loyalty.cards (member_id, business_id, token_hash)
  values (p_member.id, p_member.business_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict (member_id) do update set token_hash = excluded.token_hash, issued_at = now();
  update loyalty.members set card_issued_at = now() where id = p_member.id;
  return v_token;
end;
$$;

-- Pública (anon). Devuelve jsonb {status, token?}. status:
--   created (con token) | existing | unavailable | rate_limited |
--   invalid_name | invalid_phone | terms_required
-- 'unavailable' es igual para un código que no existe, un alta apagada o un
-- módulo apagado: no se puede averiguar qué códigos existen.
create function loyalty.self_signup(
  p_code           text,
  p_name           text,
  p_phone          text,
  p_terms_accepted boolean,
  p_whatsapp       boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_result      jsonb;
  v_member      loyalty.members;
  v_token       text;
begin
  v_business_id := core.self_signup_business(p_code);
  if v_business_id is null or not core.has_module(v_business_id, 'loyalty') then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_result := core.self_signup_customer(v_business_id, p_name, p_phone, p_terms_accepted, p_whatsapp);
  if v_result ->> 'status' <> 'created' then
    return jsonb_build_object('status', v_result ->> 'status');
  end if;

  -- Sumarse al programa no da puntos (no hay movimiento en el libro).
  insert into loyalty.members (business_id, customer_id)
  values (v_business_id, (v_result ->> 'customer_id')::uuid)
  returning * into v_member;
  v_token := loyalty.create_card(v_member);
  perform core.emit_event(v_business_id, 'loyalty.member_joined', jsonb_build_object(
    'member_id', v_member.id, 'customer_id', v_member.customer_id, 'source', 'self_signup'));

  return jsonb_build_object('status', 'created', 'token', v_token);
end;
$$;


grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
-- Se vuelven a dar las dos funciones públicas (anon): la tarjeta y el alta por QR.
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
revoke execute on all functions in schema core from public, anon;
