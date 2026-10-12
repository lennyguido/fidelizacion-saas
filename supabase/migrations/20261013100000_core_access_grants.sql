-- =============================================================================
-- CORE · Acceso solo por invitación (D-043, no destructivo). docs/ACCESOS.md
--
-- Ya no se puede registrar cualquiera y crear un negocio. El dueño de la
-- plataforma (core.platform_admins) cobra por fuera (WhatsApp, transferencia) y
-- desde su panel da un acceso: mail + plan. La Edge Function `grant-access` crea
-- el acceso y le manda a esa persona un mail de invitación para elegir contraseña.
--   * core.access_grants: accesos dados (pendiente / usado / revocado). Una sola
--     invitación pendiente por mail. Solo la ve el administrador de la plataforma.
--   * core.create_business exige un acceso pendiente para el mail de la cuenta
--     (salvo administradores de la plataforma). Al crear el negocio el acceso
--     queda usado y la suscripción toma el plan comprado.
--   * core.platform_settings.signup_mode: 'invite' (por defecto) u 'open' (solo
--     para el entorno local de pruebas: lo pone supabase/seed.sql).
--   * Planes de venta: barrio, local y cadena (docs/marketing/PRECIOS.md), con los
--     mismos módulos que el piloto. Los límites por plan se aplican más adelante.
-- =============================================================================

create table core.platform_settings (
  key   text primary key check (key in ('signup_mode')),
  value text not null
);
alter table core.platform_settings enable row level security;
insert into core.platform_settings (key, value) values ('signup_mode', 'invite');

insert into core.plans (id, name) values
  ('barrio', 'Barrio'), ('local', 'Local'), ('cadena', 'Cadena')
on conflict (id) do nothing;
insert into core.plan_modules (plan_id, module_id)
select p.id, pm.module_id
  from (values ('barrio'), ('local'), ('cadena')) as p(id)
  cross join core.plan_modules pm
 where pm.plan_id = 'pilot'
on conflict do nothing;

create table core.access_grants (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  plan_id     text not null references core.plans (id),
  status      text not null default 'pending' check (status in ('pending', 'used', 'revoked')),
  note        text check (char_length(note) <= 200),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  business_id uuid references core.businesses (id) on delete restrict,
  revoked_at  timestamptz,
  check (status <> 'used' or (used_at is not null and business_id is not null))
);

create unique index access_grants_one_pending_idx on core.access_grants (email) where status = 'pending';
create index access_grants_created_idx on core.access_grants (created_at desc);
create index access_grants_business_idx on core.access_grants (business_id) where business_id is not null;
create index access_grants_created_by_idx on core.access_grants (created_by) where created_by is not null;
create index access_grants_used_by_idx on core.access_grants (used_by) where used_by is not null;

create trigger access_grants_audit after insert or update on core.access_grants
  for each row execute function core.audit_row();

alter table core.access_grants enable row level security;
grant select on core.access_grants to authenticated;
create policy access_grants_select on core.access_grants for select to authenticated
  using ((select core.is_platform_admin()));

-- -----------------------------------------------------------------------------
-- Administración (solo administradores de la plataforma).
-- -----------------------------------------------------------------------------
create function core.require_platform_admin() returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not core.is_platform_admin() then
    perform core.raise_forbidden('platform admin only');
  end if;
end;
$$;

create function core.create_access_grant(p_email text, p_plan_id text, p_note text default null)
returns core.access_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_grant core.access_grants;
begin
  perform core.require_platform_admin();
  if not exists (select 1 from core.plans where id = p_plan_id and active) then
    raise exception 'invalid plan' using errcode = '22023';
  end if;
  -- Si ya había una invitación pendiente para ese mail, se actualiza el plan.
  update core.access_grants set plan_id = p_plan_id, note = nullif(btrim(p_note), '')
   where email = v_email and status = 'pending'
  returning * into v_grant;
  if not found then
    insert into core.access_grants (email, plan_id, note, created_by)
    values (v_email, p_plan_id, nullif(btrim(p_note), ''), (select auth.uid()))
    returning * into v_grant;
  end if;
  return v_grant;
end;
$$;

create function core.revoke_access_grant(p_grant_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform core.require_platform_admin();
  update core.access_grants set status = 'revoked', revoked_at = now()
   where id = p_grant_id and status = 'pending';
  if not found then
    raise exception 'grant not found or already used' using errcode = 'P0002';
  end if;
end;
$$;

-- ¿La cuenta actual puede crear un negocio? (para el onboarding del panel)
-- Devuelve el plan del acceso pendiente, 'admin', 'open' o null.
create function core.my_access() returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when core.is_platform_admin() then 'admin'
    when (select value from core.platform_settings where key = 'signup_mode') = 'open' then 'open'
    else (select g.plan_id from core.access_grants g
            join auth.users u on lower(u.email) = g.email
           where u.id = (select auth.uid()) and g.status = 'pending'
           limit 1)
  end
$$;

-- -----------------------------------------------------------------------------
-- Crear negocio: ahora exige un acceso (salvo modo abierto o administradores).
-- -----------------------------------------------------------------------------
create or replace function core.create_business(
  p_name     text,
  p_slug     text,
  p_timezone text default 'America/Argentina/Buenos_Aires'
) returns core.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := (select auth.uid());
  v_slug     text := lower(btrim(coalesce(p_slug, '')));
  v_business core.businesses;
  v_owned    integer;
  v_access   text;
  v_grant    core.access_grants;
  v_plan     text := 'pilot';
begin
  if v_user_id is null then
    perform core.raise_forbidden('not authenticated');
  end if;

  v_access := core.my_access();
  if v_access is null then
    perform core.raise_forbidden('access_required');
  end if;

  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$' then
    raise exception 'invalid slug' using errcode = '22023';
  end if;
  if core.is_reserved_slug(v_slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  -- Límite anti-abuso: hasta 3 negocios propios por usuario (se ajusta con planes).
  select count(*) into v_owned
    from core.memberships
   where user_id = v_user_id and role = 'owner' and status = 'active';
  if v_owned >= 3 then
    raise exception 'business_limit_reached' using errcode = '54000';
  end if;

  if v_access not in ('admin', 'open') then
    select g.* into v_grant from core.access_grants g
      join auth.users u on lower(u.email) = g.email
     where u.id = v_user_id and g.status = 'pending'
     for update of g;
    v_plan := v_grant.plan_id;
  end if;

  begin
    insert into core.businesses (name, slug, timezone)
    values (btrim(p_name), v_slug, coalesce(p_timezone, 'America/Argentina/Buenos_Aires'))
    returning * into v_business;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;

  insert into core.locations (business_id, name) values (v_business.id, 'Principal');
  insert into core.memberships (business_id, user_id, role) values (v_business.id, v_user_id, 'owner');
  if v_grant.id is null then
    insert into core.subscriptions (business_id, plan_id, status, trial_ends_at)
    values (v_business.id, 'pilot', 'trialing', now() + interval '30 days');
  else
    insert into core.subscriptions (business_id, plan_id, status)
    values (v_business.id, v_plan, 'active');
    update core.access_grants
       set status = 'used', used_at = now(), used_by = v_user_id, business_id = v_business.id
     where id = v_grant.id;
  end if;
  insert into core.business_modules (business_id, module_id)
  select v_business.id, module_id from core.plan_modules where plan_id = v_plan;

  perform core.emit_event(v_business.id, 'business.created',
                          jsonb_build_object('created_by', v_user_id, 'plan', v_plan));

  return v_business;
end;
$$;

grant execute on function
  core.create_access_grant(text, text, text),
  core.revoke_access_grant(uuid),
  core.my_access()
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
