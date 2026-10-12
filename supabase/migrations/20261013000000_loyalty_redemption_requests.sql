-- =============================================================================
-- LOYALTY · Canje desde el celular (OPORTUNIDADES #10). Plan de Claude Code,
-- tarea 7. Decisión D-037.
--
-- Aplicada en desarrollo el 2026-10-12 (pedido del dueño).
-- Agrega dos funciones para personas sin cuenta (anon), con el link secreto de
-- la tarjeta:
--   * loyalty.request_redemption(token, premio): el cliente elige el premio y
--     recibe un código de 6 caracteres (+ QR) que vence en 5 minutos. No descuenta
--     nada. Un solo pedido vivo por tarjeta (uno nuevo reemplaza al anterior).
--     Máximo 10 pedidos por hora por tarjeta.
--   * loyalty.get_redemption_request(token, pedido): la tarjeta consulta cada
--     pocos segundos si ya se canjeó.
-- Y dos para el equipo (staff, owner, admin):
--   * loyalty.find_redemption_request(negocio, código): qué pidió y si le alcanza.
--   * loyalty.confirm_redemption_request(pedido): recién ahí se descuenta, con el
--     canje que ya existe (loyalty.redeem_reward, usando el id del pedido como
--     request_id). Idempotente: confirmar dos veces devuelve el mismo canje.
-- No destructiva: tabla y funciones nuevas.
-- =============================================================================

create table loyalty.redemption_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references core.businesses (id) on delete restrict,
  member_id     uuid not null,
  reward_id     uuid not null,
  code          text not null check (code ~ '^[A-Z2-9]{6}$'),
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'replaced')),
  expires_at    timestamptz not null,
  redemption_id uuid,
  confirmed_by  uuid references auth.users (id) on delete set null,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, member_id) references loyalty.members (business_id, id) on delete cascade,
  foreign key (business_id, reward_id) references loyalty.rewards (business_id, id) on delete cascade,
  foreign key (business_id, redemption_id) references loyalty.redemptions (business_id, id) on delete restrict,
  check ((status = 'confirmed') = (redemption_id is not null))
);

create index redemption_requests_code_idx
  on loyalty.redemption_requests (business_id, code) where status = 'pending';
create index redemption_requests_member_idx
  on loyalty.redemption_requests (business_id, member_id, created_at desc);
create index redemption_requests_confirmed_by_idx
  on loyalty.redemption_requests (confirmed_by) where confirmed_by is not null;

-- Sin policies: solo se usa a través de las funciones.
alter table loyalty.redemption_requests enable row level security;

-- Interna: el socio de un link secreto de tarjeta (mismas reglas que get_card).
create function loyalty.member_from_token(p_token text) returns loyalty.members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member   loyalty.members;
  v_customer core.customers;
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
  return v_member;
end;
$$;

-- Código único entre los pedidos vivos del negocio (sin 0/O/1/I).
create function loyalty.new_request_code(p_business_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  for i in 1..20 loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    if not exists (select 1 from loyalty.redemption_requests
                    where business_id = p_business_id and code = v_code
                      and status = 'pending' and expires_at > now()) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

-- -----------------------------------------------------------------------------
-- Para el cliente (anon, con el link secreto)
-- -----------------------------------------------------------------------------
create function loyalty.request_redemption(p_token text, p_reward_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  loyalty.members;
  v_reward  loyalty.rewards;
  v_request loyalty.redemption_requests;
begin
  v_member := loyalty.member_from_token(p_token);
  if v_member.id is null then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  -- Serializa los pedidos de la misma tarjeta.
  select * into v_member from loyalty.members where id = v_member.id for update;

  if (select count(*) from loyalty.redemption_requests
       where business_id = v_member.business_id and member_id = v_member.id
         and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many requests' using errcode = '54000';
  end if;

  select * into v_reward from loyalty.rewards
   where id = p_reward_id and business_id = v_member.business_id;
  if not found then
    raise exception 'reward not found' using errcode = 'P0002';
  end if;
  if not v_reward.active or (v_reward.available_until is not null and v_reward.available_until <= now()) then
    raise exception 'reward_unavailable' using errcode = '22023';
  end if;
  if v_member.points_balance < v_reward.cost_points then
    raise exception 'insufficient_points' using errcode = '22023';
  end if;

  update loyalty.redemption_requests set status = 'replaced'
   where business_id = v_member.business_id and member_id = v_member.id and status = 'pending';

  -- Un código a la vez por negocio, para que dos pedidos simultáneos no repitan.
  perform pg_advisory_xact_lock(hashtext('loyalty.redemption_requests:' || v_member.business_id));
  insert into loyalty.redemption_requests (business_id, member_id, reward_id, code, expires_at)
  values (v_member.business_id, v_member.id, v_reward.id,
          loyalty.new_request_code(v_member.business_id), now() + interval '5 minutes')
  returning * into v_request;

  return jsonb_build_object(
    'requestId', v_request.id, 'code', v_request.code, 'expiresAt', v_request.expires_at,
    'rewardName', v_reward.name, 'costPoints', v_reward.cost_points);
end;
$$;

create function loyalty.get_redemption_request(p_token text, p_request_id uuid) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member  loyalty.members;
  v_request loyalty.redemption_requests;
  v_code    text;
begin
  v_member := loyalty.member_from_token(p_token);
  if v_member.id is null then
    return null;
  end if;
  select * into v_request from loyalty.redemption_requests
   where id = p_request_id and business_id = v_member.business_id and member_id = v_member.id;
  if not found then
    return null;
  end if;
  if v_request.redemption_id is not null then
    select code into v_code from loyalty.redemptions
     where business_id = v_request.business_id and id = v_request.redemption_id;
  end if;
  return jsonb_build_object(
    'status', case
      when v_request.status = 'pending' and v_request.expires_at <= now() then 'expired'
      else v_request.status end,
    'expiresAt', v_request.expires_at,
    'redemptionCode', v_code);
end;
$$;

-- -----------------------------------------------------------------------------
-- Para el equipo (mostrador)
-- -----------------------------------------------------------------------------
create function loyalty.find_redemption_request(p_business_id uuid, p_code text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request  loyalty.redemption_requests;
  v_member   loyalty.members;
  v_reward   loyalty.rewards;
  v_customer core.customers;
begin
  perform core.require_member(p_business_id);
  perform loyalty.require_module(p_business_id);

  select * into v_request from loyalty.redemption_requests
   where business_id = p_business_id and code = upper(btrim(coalesce(p_code, '')))
     and status = 'pending' and expires_at > now()
   order by created_at desc
   limit 1;
  if not found then
    return null;
  end if;
  select * into v_member from loyalty.members where id = v_request.member_id;
  select * into v_reward from loyalty.rewards where id = v_request.reward_id;
  select * into v_customer from core.customers
   where business_id = v_member.business_id and id = v_member.customer_id;

  return jsonb_build_object(
    'requestId', v_request.id, 'expiresAt', v_request.expires_at,
    'customerId', v_customer.id, 'customerName', v_customer.name,
    'rewardName', v_reward.name, 'costPoints', v_reward.cost_points,
    'pointsBalance', v_member.points_balance,
    'enough', v_member.points_balance >= v_reward.cost_points);
end;
$$;

create function loyalty.confirm_redemption_request(p_request_id uuid) returns loyalty.redemptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request    loyalty.redemption_requests;
  v_redemption loyalty.redemptions;
begin
  select * into v_request from loyalty.redemption_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_request.business_id);
  perform loyalty.require_module(v_request.business_id);

  if v_request.status = 'confirmed' then
    select * into v_redemption from loyalty.redemptions
     where business_id = v_request.business_id and id = v_request.redemption_id;
    return v_redemption;
  end if;
  if v_request.status <> 'pending' or v_request.expires_at <= now() then
    raise exception 'request_expired' using errcode = '22023';
  end if;

  -- El canje de siempre: valida saldo y premio otra vez y descuenta.
  v_redemption := loyalty.redeem_reward(v_request.member_id, v_request.reward_id, v_request.id);

  update loyalty.redemption_requests
     set status = 'confirmed', redemption_id = v_redemption.id,
         confirmed_by = (select auth.uid()), confirmed_at = now()
   where id = v_request.id;
  return v_redemption;
end;
$$;

grant execute on function
  loyalty.find_redemption_request(uuid, text),
  loyalty.confirm_redemption_request(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function
  loyalty.get_card(text),
  loyalty.request_redemption(text, uuid),
  loyalty.get_redemption_request(text, uuid)
to anon;
-- Funciones anon de otras migraciones que pueden estar aplicadas antes o después.
do $$
begin
  if to_regprocedure('loyalty.self_signup(text,text,text,boolean,boolean)') is not null then
    grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
  end if;
  if to_regprocedure('loyalty.submit_feedback(text,uuid,integer,text)') is not null then
    grant execute on function loyalty.submit_feedback(text, uuid, integer, text) to anon;
  end if;
end;
$$;
