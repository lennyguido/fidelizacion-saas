-- =============================================================================
-- LOYALTY · Tarjeta digital del cliente (link secreto + código para el mostrador).
--
-- Decisión D-020: el cliente no necesita cuenta ni contraseña. El negocio le manda
-- un link con un código secreto (como el link de una entrada) y con eso ve su
-- tarjeta: puntos, recompensas, movimientos y su código para el mostrador.
--   * En la base se guarda solo el hash del código secreto.
--   * Generar un link nuevo invalida el anterior.
--   * La tarjeta es SOLO LECTURA y muestra lo mínimo (nombre de pila, sin teléfono ni email).
--   * El código de socio (8 caracteres) no es secreto: sirve para que el cajero lo
--     encuentre rápido (escaneando el QR o escribiéndolo).
-- =============================================================================

create function loyalty.new_member_code(p_business_id uuid) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  for i in 1..20 loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 8);
    if not exists (select 1 from loyalty.members where business_id = p_business_id and member_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

alter table loyalty.members
  add column member_code    text check (member_code ~ '^[A-Z2-9]{8}$'),
  add column card_issued_at timestamptz;

update loyalty.members m set member_code = loyalty.new_member_code(m.business_id) where member_code is null;
alter table loyalty.members alter column member_code set not null;
alter table loyalty.members add constraint members_business_code_key unique (business_id, member_code);

create function loyalty.set_member_code() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_code is null then
    new.member_code := loyalty.new_member_code(new.business_id);
  end if;
  return new;
end;
$$;

create trigger members_set_code before insert on loyalty.members
  for each row execute function loyalty.set_member_code();

-- El hash del link vive en una tabla aparte, sin permisos para nadie: así no
-- aparece en ninguna consulta ni en lo que devuelven las funciones de socios.
create table loyalty.cards (
  member_id   uuid primary key,
  business_id uuid not null references core.businesses (id) on delete restrict,
  token_hash  text not null unique,
  issued_at   timestamptz not null default now(),
  foreign key (business_id, member_id) references loyalty.members (business_id, id) on delete restrict
);
create index cards_business_idx on loyalty.cards (business_id);
alter table loyalty.cards enable row level security;

-- -----------------------------------------------------------------------------
-- Generar (o regenerar) el link de la tarjeta. Cualquier miembro del equipo.
-- Devuelve el código secreto UNA vez.
-- -----------------------------------------------------------------------------
create function loyalty.issue_card(p_member_id uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member loyalty.members;
  v_token  text;
begin
  select * into v_member from loyalty.members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_member.business_id);
  perform loyalty.require_module(v_member.business_id);
  if v_member.status <> 'active' then
    raise exception 'member_inactive' using errcode = '22023';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into loyalty.cards (member_id, business_id, token_hash)
  values (v_member.id, v_member.business_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict (member_id) do update set token_hash = excluded.token_hash, issued_at = now();
  update loyalty.members set card_issued_at = now() where id = p_member_id;
  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ver la tarjeta con el código secreto. La puede llamar cualquiera (incluso sin
-- sesión): es la única función pública de la plataforma (ver meta-test).
-- Devuelve null si el código no existe, el socio salió o el módulo está apagado.
-- -----------------------------------------------------------------------------
create function loyalty.get_card(p_token text) returns jsonb
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
  select * into v_business from core.businesses where id = v_member.business_id;
  select * into v_customer from core.customers where id = v_member.customer_id;
  select * into v_program from loyalty.programs where business_id = v_member.business_id;

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
               order by created_at desc, id desc limit 10) l), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Buscar un socio por su código (QR o escrito) en el mostrador.
-- -----------------------------------------------------------------------------
create function loyalty.find_member_by_code(p_business_id uuid, p_code text) returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  perform core.require_member(p_business_id);
  perform loyalty.require_module(p_business_id);
  select customer_id into v_customer_id from loyalty.members
   where business_id = p_business_id and member_code = upper(btrim(coalesce(p_code, '')));
  return v_customer_id;
end;
$$;

grant usage on schema loyalty to anon;
grant execute on function loyalty.get_card(text) to anon, authenticated;
grant execute on function
  loyalty.issue_card(uuid),
  loyalty.find_member_by_code(uuid, text)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public;
revoke execute on all functions in schema loyalty from anon;
grant execute on function loyalty.get_card(text) to anon;
revoke execute on all functions in schema core from public, anon;
