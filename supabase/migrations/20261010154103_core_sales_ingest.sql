-- =============================================================================
-- CORE · Ventas que entran solas desde la caja (D-033, no destructivo).
-- docs/CAPTURA-AUTOMATICA.md
--
-- La caja (o un sistema de gestión) manda cada venta a la Edge Function
-- `sales-ingest` con una clave del negocio. La función llama a core.ingest_sale
-- con la service role:
--   * La clave la genera nuestro sistema y solo se guarda su hash (sha256), como
--     una contraseña. Se ve una sola vez al crearla. Se puede revocar.
--   * Cada venta es una visita con source = 'pos' y source_ref = número de
--     comprobante: core.record_visit_internal ya deduplica por (negocio, origen,
--     comprobante), así que mandar la misma venta dos veces no la duplica.
--   * Se identifica al cliente por celular (o por código de socio, que resuelve
--     loyalty). Si no coincide nadie, la visita queda sin identificar y cuenta
--     igual para las estadísticas del negocio.
--   * No se guarda DNI.
-- =============================================================================

create table core.integration_keys (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references core.businesses (id) on delete restrict,
  location_id  uuid,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  -- Primeros caracteres de la clave, para reconocerla en la lista (no sirven para usarla).
  key_prefix   text not null check (key_prefix ~ '^lk_[0-9a-f]{6}$'),
  key_hash     text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  unique (business_id, id),
  foreign key (business_id, location_id) references core.locations (business_id, id) on delete restrict
);

create index integration_keys_business_idx on core.integration_keys (business_id, created_at desc);
create index integration_keys_location_idx on core.integration_keys (business_id, location_id)
  where location_id is not null;
create index integration_keys_created_by_idx on core.integration_keys (created_by)
  where created_by is not null;

create trigger integration_keys_audit after insert or update on core.integration_keys
  for each row execute function core.audit_row();

alter table core.integration_keys enable row level security;
-- El hash no se expone: el panel lee solo estas columnas.
grant select (id, business_id, location_id, name, key_prefix, created_at, last_used_at, revoked_at)
  on core.integration_keys to authenticated;
create policy integration_keys_select on core.integration_keys for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- -----------------------------------------------------------------------------
-- Crear y revocar claves (dueño o admin).
-- -----------------------------------------------------------------------------
create function core.create_integration_key(
  p_business_id uuid, p_name text, p_location_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'lk_' || encode(extensions.gen_random_bytes(20), 'hex');
  v_id  uuid;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if p_location_id is not null and not exists (
       select 1 from core.locations where business_id = p_business_id and id = p_location_id) then
    raise exception 'location not found' using errcode = 'P0002';
  end if;
  insert into core.integration_keys (business_id, location_id, name, key_prefix, key_hash, created_by)
  values (p_business_id, p_location_id, btrim(coalesce(p_name, '')), left(v_key, 9),
          encode(extensions.digest(v_key, 'sha256'), 'hex'), (select auth.uid()))
  returning id into v_id;
  -- La clave completa se devuelve UNA vez; después solo queda el hash.
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', left(v_key, 9));
end;
$$;

create function core.revoke_integration_key(p_key_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key core.integration_keys;
begin
  select * into v_key from core.integration_keys where id = p_key_id for update;
  if not found then
    raise exception 'key not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_key.business_id, array['owner', 'admin']);
  update core.integration_keys set revoked_at = coalesce(revoked_at, now()) where id = p_key_id;
end;
$$;

-- Negocio y sucursal de una clave vigente (interno). Null si no existe o se revocó.
create function core.integration_key_for(p_key_hash text) returns core.integration_keys
language sql
stable
set search_path = ''
as $$
  select k.* from core.integration_keys k
    join core.businesses b on b.id = k.business_id
   where k.key_hash = p_key_hash and k.revoked_at is null and b.status = 'active'
$$;

-- -----------------------------------------------------------------------------
-- Registrar una venta (interno, lo usan ingest_sale y el simulador).
-- -----------------------------------------------------------------------------
create function core.ingest_sale_for(
  p_business_id  uuid,
  p_location_id  uuid,
  p_receipt      text,
  p_amount_minor bigint,
  p_occurred_at  timestamptz,
  p_phone        text,
  p_customer_id  uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_receipt     text := btrim(coalesce(p_receipt, ''));
  v_customer_id uuid;
  v_existed     boolean;
  v_visit       core.visits;
begin
  if char_length(v_receipt) not between 1 and 200 then
    return jsonb_build_object('status', 'invalid', 'message', 'receipt is required');
  end if;
  if p_amount_minor is not null and (p_amount_minor < 0 or p_amount_minor > 100000000000) then
    return jsonb_build_object('status', 'invalid', 'message', 'invalid amount');
  end if;

  -- Cliente: el indicado (código de socio) o el de ese celular. Solo activos.
  select c.id into v_customer_id from core.customers c
   where c.business_id = p_business_id and c.status = 'active' and c.anonymized_at is null
     and (c.id = p_customer_id or (p_customer_id is null and p_phone is not null and c.phone = p_phone))
   limit 1;

  v_existed := exists (select 1 from core.visits
                        where business_id = p_business_id and source = 'pos' and source_ref = v_receipt);
  begin
    v_visit := core.record_visit_internal(p_business_id, p_location_id, v_customer_id, p_amount_minor,
                                          p_occurred_at, 'pos', v_receipt, null, null);
  exception when sqlstate '22023' or sqlstate 'P0002' then
    return jsonb_build_object('status', 'invalid', 'message', sqlerrm);
  end;

  return jsonb_build_object(
    'status', case when v_existed then 'duplicate' else 'created' end,
    'visitId', v_visit.id,
    'identified', v_visit.customer_id is not null);
end;
$$;

-- -----------------------------------------------------------------------------
-- Puerta de entrada (solo la Edge Function, con la service role).
-- status: created | duplicate | invalid | unauthorized
-- -----------------------------------------------------------------------------
create function core.ingest_sale(
  p_key_hash     text,
  p_receipt      text,
  p_amount_minor bigint default null,
  p_occurred_at  timestamptz default null,
  p_phone        text default null,
  p_customer_id  uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    core.integration_keys;
  v_result jsonb;
begin
  v_key := core.integration_key_for(p_key_hash);
  if v_key.id is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;
  v_result := core.ingest_sale_for(v_key.business_id, v_key.location_id, p_receipt, p_amount_minor,
                                   p_occurred_at, p_phone, p_customer_id);
  update core.integration_keys set last_used_at = now() where id = v_key.id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Simulador del panel (dueño o admin): manda una venta de prueba como si viniera
-- de la caja, sin clave. El comprobante empieza con "PRUEBA-".
-- -----------------------------------------------------------------------------
create function core.simulate_sale(p_business_id uuid, p_amount_minor bigint, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  return core.ingest_sale_for(p_business_id, null,
                              'PRUEBA-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
                              p_amount_minor, null, nullif(btrim(p_phone), ''), null);
end;
$$;

grant execute on function
  core.create_integration_key(uuid, text, uuid),
  core.revoke_integration_key(uuid),
  core.simulate_sale(uuid, bigint, text)
to authenticated;
grant execute on function
  core.ingest_sale(text, text, bigint, timestamptz, text, uuid)
to service_role;

-- -----------------------------------------------------------------------------
-- LOYALTY · Código de socio → cliente, para la caja (solo service role).
-- La clave define el negocio: no se puede buscar socios de otro.
-- -----------------------------------------------------------------------------
create function loyalty.integration_member_customer(p_key_hash text, p_code text) returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key core.integration_keys;
begin
  v_key := core.integration_key_for(p_key_hash);
  if v_key.id is null or not core.has_module(v_key.business_id, 'loyalty') then
    return null;
  end if;
  return (select m.customer_id from loyalty.members m
           where m.business_id = v_key.business_id and m.status = 'active'
             and m.member_code = upper(btrim(coalesce(p_code, ''))));
end;
$$;

grant execute on function loyalty.integration_member_customer(text, text) to service_role;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
revoke execute on function core.ingest_sale(text, text, bigint, timestamptz, text, uuid) from authenticated;
revoke execute on all functions in schema loyalty from public, anon;
revoke execute on function loyalty.integration_member_customer(text, text) from authenticated;
grant execute on function loyalty.get_card(text) to anon;
