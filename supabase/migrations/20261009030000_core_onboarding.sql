-- =============================================================================
-- CORE · Onboarding: crear un negocio completo en una sola transacción.
-- Ver TASKS.md Fase 2 y secciones 14/16.
-- =============================================================================

-- Slugs que no puede usar un negocio (rutas y subdominios de la plataforma).
create function core.is_reserved_slug(p_slug text) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'auth', 'billing', 'blog', 'club', 'dashboard', 'demo', 'docs',
    'help', 'login', 'logout', 'mail', 'panel', 'signup', 'soporte', 'static', 'status',
    'support', 'www'
  ])
$$;

-- ¿Está libre este slug? (para el formulario de onboarding)
create function core.is_slug_available(p_slug text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$'
     and not core.is_reserved_slug(p_slug)
     and not exists (select 1 from core.businesses where slug = p_slug)
$$;

-- Crea negocio + sucursal principal + membresía owner + suscripción piloto en
-- prueba + módulos del plan. Devuelve el negocio creado.
create function core.create_business(
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
begin
  if v_user_id is null then
    perform core.raise_forbidden('not authenticated');
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

  begin
    insert into core.businesses (name, slug, timezone)
    values (btrim(p_name), v_slug, coalesce(p_timezone, 'America/Argentina/Buenos_Aires'))
    returning * into v_business;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;

  insert into core.locations (business_id, name) values (v_business.id, 'Principal');
  insert into core.memberships (business_id, user_id, role) values (v_business.id, v_user_id, 'owner');
  insert into core.subscriptions (business_id, plan_id, status, trial_ends_at)
  values (v_business.id, 'pilot', 'trialing', now() + interval '30 days');
  insert into core.business_modules (business_id, module_id)
  select v_business.id, module_id from core.plan_modules where plan_id = 'pilot';

  perform core.emit_event(v_business.id, 'business.created',
                          jsonb_build_object('created_by', v_user_id, 'plan', 'pilot'));

  return v_business;
end;
$$;

grant execute on function
  core.is_slug_available(text),
  core.create_business(text, text, text)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
