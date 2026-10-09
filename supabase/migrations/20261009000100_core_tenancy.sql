-- =============================================================================
-- CORE · Tenancy: negocios, sucursales, membresías, administradores de plataforma
-- y helpers de RLS. Ver docs/ARCHITECTURE.md §3.
-- =============================================================================

create schema if not exists core;

-- Nadie usa el esquema salvo los roles de Supabase que lo necesitan.
revoke all on schema core from public;
grant usage on schema core to authenticated, service_role;

-- Las funciones se habilitan explícitamente a cada rol; ver el revoke al final
-- de cada migración.
alter default privileges in schema core grant all on tables to service_role;
alter default privileges in schema core grant all on sequences to service_role;
alter default privileges in schema core grant execute on functions to service_role;

-- -----------------------------------------------------------------------------
-- Utilidades genéricas
-- -----------------------------------------------------------------------------

create function core.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function core.is_valid_timezone(p_tz text) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz)
$$;

-- Lanza un error de permisos (PostgREST lo devuelve como 403).
create function core.raise_forbidden(p_message text default 'forbidden') returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = '42501';
end;
$$;

-- -----------------------------------------------------------------------------
-- Negocios (el tenant)
-- -----------------------------------------------------------------------------

create table core.businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$'),
  timezone        text not null default 'America/Argentina/Buenos_Aires',
  currency        text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  logo_path       text,
  primary_color   text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  phone           text,
  email           text,
  address         text,
  settings        jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  status          text not null default 'active' check (status in ('active', 'suspended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table core.businesses is 'Tenant. Cada negocio cliente de la plataforma.';

create function core.validate_business() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not core.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger businesses_validate before insert or update of timezone on core.businesses
  for each row execute function core.validate_business();
create trigger businesses_updated_at before update on core.businesses
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sucursales
-- -----------------------------------------------------------------------------

create table core.locations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  address     text,
  timezone    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, id)
);

create index locations_business_idx on core.locations (business_id);

create function core.validate_location() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null and not core.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger locations_validate before insert or update of timezone on core.locations
  for each row execute function core.validate_location();
create trigger locations_updated_at before update on core.locations
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Membresías: usuario ↔ negocio con rol
-- -----------------------------------------------------------------------------

create table core.memberships (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'staff')),
  status      text not null default 'active' check (status in ('active', 'disabled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id),
  unique (business_id, id)
);

create index memberships_user_idx on core.memberships (user_id) where status = 'active';

create trigger memberships_updated_at before update on core.memberships
  for each row execute function core.set_updated_at();

-- Un negocio nunca se queda sin dueño activo.
create function core.ensure_active_owner() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_business_id uuid := coalesce(old.business_id, new.business_id);
begin
  if exists (select 1 from core.businesses where id = v_business_id)
     and not exists (
       select 1 from core.memberships
       where business_id = v_business_id and role = 'owner' and status = 'active'
     ) then
    raise exception 'a business must keep at least one active owner' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_keep_owner
  after update or delete on core.memberships
  deferrable initially deferred
  for each row execute function core.ensure_active_owner();

-- -----------------------------------------------------------------------------
-- Administradores de la plataforma (tu empresa). Nunca accesible por API.
-- -----------------------------------------------------------------------------

create table core.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Helpers de RLS
--
-- Para policies se usan las variantes que devuelven conjuntos, con el patrón
--   business_id in (select core.my_business_ids())
-- que Postgres evalúa UNA vez por consulta (initplan), no por fila.
-- Las variantes booleanas se usan dentro de funciones.
-- -----------------------------------------------------------------------------

create function core.my_business_ids() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from core.memberships m
  join core.businesses b on b.id = m.business_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and b.status = 'active'
$$;

create function core.my_business_ids_with_role(p_roles text[]) returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from core.memberships m
  join core.businesses b on b.id = m.business_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and b.status = 'active'
    and m.role = any (p_roles)
$$;

create function core.is_member(p_business_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from core.my_business_ids() id where id = p_business_id)
$$;

create function core.has_role(p_business_id uuid, p_roles text[]) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from core.my_business_ids_with_role(p_roles) id where id = p_business_id)
$$;

create function core.is_platform_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from core.platform_admins where user_id = (select auth.uid()))
$$;

-- Exige membresía (y opcionalmente rol); si no, error 403.
create function core.require_member(p_business_id uuid, p_roles text[] default null) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    perform core.raise_forbidden('not authenticated');
  end if;
  if p_roles is null then
    if not core.is_member(p_business_id) then
      perform core.raise_forbidden('not a member of this business');
    end if;
  elsif not core.has_role(p_business_id, p_roles) then
    perform core.raise_forbidden('insufficient role');
  end if;
end;
$$;

grant execute on function
  core.my_business_ids(),
  core.my_business_ids_with_role(text[]),
  core.is_member(uuid),
  core.has_role(uuid, text[]),
  core.is_platform_admin()
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS y permisos
-- -----------------------------------------------------------------------------

alter table core.businesses enable row level security;
alter table core.locations enable row level security;
alter table core.memberships enable row level security;
alter table core.platform_admins enable row level security;

grant select on core.businesses, core.locations, core.memberships to authenticated;

-- Negocios: los miembros ven su negocio; owner/admin editan datos de perfil.
-- El estado (status) y el id no se pueden cambiar desde el cliente.
grant update (name, slug, timezone, currency, logo_path, primary_color, secondary_color,
              phone, email, address, settings)
  on core.businesses to authenticated;

create policy businesses_select on core.businesses
  for select to authenticated
  using (id in (select core.my_business_ids()));

create policy businesses_update on core.businesses
  for update to authenticated
  using (id in (select core.my_business_ids_with_role(array['owner', 'admin'])))
  with check (id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- Sucursales: miembros leen; owner/admin crean y editan. No se borran (se desactivan).
grant insert (business_id, name, address, timezone, active) on core.locations to authenticated;
grant update (name, address, timezone, active) on core.locations to authenticated;

create policy locations_select on core.locations
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

create policy locations_insert on core.locations
  for insert to authenticated
  with check (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

create policy locations_update on core.locations
  for update to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])))
  with check (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- Membresías: los miembros ven al equipo de su negocio. Se modifican solo por
-- funciones (invitar, cambiar rol) para evitar escaladas de privilegio.
create policy memberships_select on core.memberships
  for select to authenticated
  using (business_id in (select core.my_business_ids()) or user_id = (select auth.uid()));

-- platform_admins: RLS habilitado y sin policies → inaccesible por API.

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
