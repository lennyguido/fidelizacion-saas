-- =============================================================================
-- LOYALTY · Tarjeta de sellos en Google Wallet / Apple Wallet (docs/WALLET.md,
-- "Tarjeta de sellos"). No destructiva: solo `create or replace` y una función
-- nueva. Todo sigue siendo solo para la Edge Function (service role).
--
--   * wallet_pass_data: agrega `programKind` ('points' | 'stamps') y `stampGoal`
--     (costo de la próxima recompensa; si ya le alcanzan todas, el de la más
--     barata; null sin recompensas). Con eso el pase dibuja la fila de sellos.
--   * wallet_stamp_brand(business_id): color y logo del negocio para la imagen
--     pública de sellos (GET /wallet/stamps.png). null si el negocio no existe o
--     no tiene el módulo de fidelización. El logo y el color ya son públicos (D-024).
-- =============================================================================

create or replace function loyalty.wallet_pass_data(p_pass_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pass     loyalty.wallet_passes;
  v_member   loyalty.members;
  v_customer core.customers;
  v_business core.businesses;
  v_program  loyalty.programs;
  v_active   boolean;
  v_next     jsonb;
  v_cheapest bigint;
begin
  select * into v_pass from loyalty.wallet_passes where id = p_pass_id;
  if not found then
    return null;
  end if;
  select * into v_member from loyalty.members where business_id = v_pass.business_id and id = v_pass.member_id;
  select * into v_customer from core.customers
   where business_id = v_member.business_id and id = v_member.customer_id;
  select * into v_business from core.businesses where id = v_pass.business_id;
  select * into v_program from loyalty.programs where business_id = v_pass.business_id;

  v_active := v_member.status = 'active' and v_customer.status = 'active'
              and v_customer.anonymized_at is null and core.has_module(v_pass.business_id, 'loyalty');

  select jsonb_build_object('name', r.name, 'costPoints', r.cost_points) into v_next
    from loyalty.rewards r
   where r.business_id = v_pass.business_id and r.active
     and (r.available_until is null or r.available_until > now())
     and r.cost_points > v_member.points_balance
   order by r.cost_points, r.id
   limit 1;

  select min(r.cost_points) into v_cheapest
    from loyalty.rewards r
   where r.business_id = v_pass.business_id and r.active
     and (r.available_until is null or r.available_until > now());

  return jsonb_build_object(
    'passId', v_pass.id,
    'provider', v_pass.provider,
    'objectId', v_pass.object_id,
    'businessId', v_pass.business_id,
    'updatedAt', v_pass.updated_at,
    'active', v_active,
    'business', jsonb_build_object(
      'name', v_business.name, 'primaryColor', v_business.primary_color, 'logoPath', v_business.logo_path),
    'firstName', case when v_active then split_part(btrim(v_customer.name), ' ', 1) else null end,
    'memberCode', v_member.member_code,
    'pointsBalance', v_member.points_balance,
    'unit', case when v_program.kind = 'stamps' then 'sellos' else 'puntos' end,
    'programKind', case when v_program.kind = 'stamps' then 'stamps' else 'points' end,
    'nextReward', v_next,
    'stampGoal', coalesce((v_next ->> 'costPoints')::bigint, v_cheapest),
    'rewardsAvailable', (
      select count(*) from loyalty.rewards r
       where r.business_id = v_pass.business_id and r.active
         and (r.available_until is null or r.available_until > now())
         and r.cost_points <= v_member.points_balance)
  );
end;
$$;

create function loyalty.wallet_stamp_brand(p_business_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
begin
  select * into v_business from core.businesses where id = p_business_id;
  if not found or not core.has_module(p_business_id, 'loyalty') then
    return null;
  end if;
  return jsonb_build_object('primaryColor', v_business.primary_color, 'logoPath', v_business.logo_path);
end;
$$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on function loyalty.wallet_stamp_brand(uuid) from authenticated;
grant execute on function loyalty.wallet_pass_data(uuid), loyalty.wallet_stamp_brand(uuid) to service_role;
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
