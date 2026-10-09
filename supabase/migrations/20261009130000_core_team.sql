-- =============================================================================
-- CORE · Equipo: invitar empleados, aceptar invitaciones y administrar miembros.
--
-- Flujo: el dueño (o un admin) crea una invitación para un email → recibe un link
-- con un código secreto → lo comparte (WhatsApp, mail) → la persona inicia sesión
-- con ESE email y acepta → queda como miembro con el rol indicado.
-- En la base se guarda solo el hash del código, nunca el código.
-- =============================================================================

create table core.invitations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  role        text not null check (role in ('admin', 'staff')),
  token_hash  text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at  timestamptz,
  unique (business_id, id)
);

create index invitations_business_idx on core.invitations (business_id, created_at desc);
-- Una sola invitación pendiente por email y negocio.
create unique index invitations_one_pending_idx on core.invitations (business_id, email)
  where accepted_at is null and revoked_at is null;
create index invitations_created_by_idx on core.invitations (created_by) where created_by is not null;
create index invitations_accepted_by_idx on core.invitations (accepted_by) where accepted_by is not null;

alter table core.invitations enable row level security;
grant select (id, business_id, email, role, created_by, created_at, expires_at, accepted_at, revoked_at)
  on core.invitations to authenticated;

create policy invitations_select on core.invitations
  for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

create trigger invitations_audit after insert or update on core.invitations
  for each row execute function core.audit_row();

create function core.hash_token(p_token text) returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- -----------------------------------------------------------------------------
-- Crear invitación (owner invita admin/staff; admin invita solo staff).
-- Devuelve el código UNA vez; no se puede volver a consultar.
-- -----------------------------------------------------------------------------
create function core.create_invitation(p_business_id uuid, p_email text, p_role text)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id    uuid;
  v_exp   timestamptz;
begin
  if p_role is null or p_role not in ('admin', 'staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_role = 'admin' then
    perform core.require_member(p_business_id, array['owner']);
  else
    perform core.require_member(p_business_id, array['owner', 'admin']);
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  if exists (
    select 1 from core.memberships m join auth.users u on u.id = m.user_id
     where m.business_id = p_business_id and m.status = 'active' and lower(u.email) = v_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  -- Reemplaza una invitación pendiente anterior para el mismo email.
  update core.invitations i
     set revoked_at = now()
   where i.business_id = p_business_id and i.email = v_email
     and i.accepted_at is null and i.revoked_at is null;

  -- 244 bits aleatorios (dos UUID v4) sin depender de extensiones.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into core.invitations (business_id, email, role, token_hash, created_by)
  values (p_business_id, v_email, p_role, core.hash_token(v_token), (select auth.uid()))
  returning id, core.invitations.expires_at into v_id, v_exp;

  perform core.emit_event(p_business_id, 'team.invitation_created',
                          jsonb_build_object('invitation_id', v_id, 'role', p_role));

  return query select v_id, v_token, v_exp;
end;
$$;

create function core.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv core.invitations;
begin
  select * into v_inv from core.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_inv.business_id, array['owner', 'admin']);
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    raise exception 'invitation is no longer pending' using errcode = '22023';
  end if;
  update core.invitations set revoked_at = now() where id = p_invitation_id;
end;
$$;

-- Lo que ve la persona invitada antes de aceptar (requiere sesión iniciada).
create function core.get_invitation(p_token text)
returns table (business_name text, role text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, i.role, i.email,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now() then 'expired'
           else 'pending'
         end
    from core.invitations i
    join core.businesses b on b.id = i.business_id
   where i.token_hash = core.hash_token(p_token)
     and (select auth.uid()) is not null
$$;

-- Aceptar: el usuario tiene que haber iniciado sesión con el MISMO email invitado.
create function core.accept_invitation(p_token text) returns core.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email   text;
  v_inv     core.invitations;
  v_business core.businesses;
begin
  if v_user_id is null then
    perform core.raise_forbidden('not authenticated');
  end if;
  select lower(email) into v_email from auth.users where id = v_user_id;

  select * into v_inv from core.invitations
   where token_hash = core.hash_token(coalesce(p_token, ''))
   for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation_unavailable' using errcode = '22023';
  end if;
  if v_email is distinct from v_inv.email then
    perform core.raise_forbidden('invitation_email_mismatch');
  end if;

  insert into core.memberships (business_id, user_id, role)
  values (v_inv.business_id, v_user_id, v_inv.role)
  on conflict (business_id, user_id) do update
    set role = excluded.role, status = 'active'
    where core.memberships.role <> 'owner';

  update core.invitations set accepted_at = now(), accepted_by = v_user_id where id = v_inv.id;

  perform core.emit_event(v_inv.business_id, 'team.member_joined',
                          jsonb_build_object('user_id', v_user_id, 'role', v_inv.role));

  select * into v_business from core.businesses where id = v_inv.business_id;
  return v_business;
end;
$$;

-- -----------------------------------------------------------------------------
-- Miembros del equipo (con email, que vive en auth.users). Solo owner/admin.
-- -----------------------------------------------------------------------------
create function core.list_members(p_business_id uuid)
returns table (membership_id uuid, user_id uuid, email text, role text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  return query
    select m.id, m.user_id, u.email::text, m.role, m.status, m.created_at
      from core.memberships m
      join auth.users u on u.id = m.user_id
     where m.business_id = p_business_id
     order by (m.role = 'owner') desc, m.created_at;
end;
$$;

-- Cambiar rol o activar/desactivar un miembro. Solo el owner.
-- El trigger memberships_keep_owner impide quedarse sin dueño activo.
create function core.update_member(p_membership_id uuid, p_role text, p_status text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member core.memberships;
begin
  select * into v_member from core.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_member.business_id, array['owner']);

  if p_role is null or p_role not in ('owner', 'admin', 'staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('active', 'disabled') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update core.memberships set role = p_role, status = p_status where id = p_membership_id;
end;
$$;

grant execute on function
  core.create_invitation(uuid, text, text),
  core.revoke_invitation(uuid),
  core.get_invitation(text),
  core.accept_invitation(text),
  core.list_members(uuid),
  core.update_member(uuid, text, text)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
