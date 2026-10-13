-- =============================================================================
-- CORE · El tope de equipo del plan se controla al invitar (D-047).
--
-- Antes el límite (D-044) solo saltaba al aceptar la invitación: el dueño podía
-- invitar a más gente de la que su plan permite y la persona recién se enteraba
-- al querer entrar. Ahora create_invitation cuenta equipo activo + invitaciones
-- pendientes y avisa en el momento (plan_limit_reached), para ofrecer el plan
-- siguiente. El trigger de memberships sigue como red de seguridad.
-- =============================================================================

create or replace function core.create_invitation(p_business_id uuid, p_email text, p_role text)
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
  v_status text;
  v_limit  integer;
  v_count  integer;
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

  -- Quien ya tiene una membresía (activa o desactivada) no se invita: un
  -- desactivado solo lo reactiva el dueño con update_member.
  select m.status into v_status
    from core.memberships m join auth.users u on u.id = m.user_id
   where m.business_id = p_business_id and lower(u.email) = v_email;
  if v_status = 'active' then
    raise exception 'already_member' using errcode = '23505';
  elsif v_status is not null then
    raise exception 'member_disabled' using errcode = '23505';
  end if;

  -- Tope de equipo del plan (D-044): cuentan los miembros activos y las
  -- invitaciones pendientes (menos la que se reemplaza para este mismo email).
  -- Así no se invita a alguien que después no va a poder entrar.
  v_limit := core.plan_limit(p_business_id, 'max_staff');
  if v_limit is not null then
    select count(*) into v_count from core.memberships
     where business_id = p_business_id and role <> 'owner' and status = 'active';
    select v_count + count(*) into v_count from core.invitations i
     where i.business_id = p_business_id and i.email <> v_email
       and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
    if v_count >= v_limit then
      raise exception 'plan_limit_reached: max_staff' using errcode = '54000';
    end if;
  end if;

  -- Reemplaza una invitación pendiente anterior para el mismo email. Una
  -- invitación de admin (la creó el dueño) solo la puede reemplazar el dueño.
  if exists (
    select 1 from core.invitations i
     where i.business_id = p_business_id and i.email = v_email and i.role = 'admin'
       and i.accepted_at is null and i.revoked_at is null
  ) then
    perform core.require_member(p_business_id, array['owner']);
  end if;

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

revoke execute on all functions in schema core from public, anon;
