-- =============================================================================
-- CORE · Proteger a los dueños entre sí.
--
-- Si un negocio tiene dos o más dueños, ninguno puede quitarle el rol de dueño
-- ni desactivar a OTRO dueño. Cada dueño solo puede cambiarse a sí mismo
-- (por ejemplo, pasar a admin), y el trigger memberships_keep_owner sigue
-- impidiendo que el negocio quede sin ningún dueño activo.
-- Reemplaza core.update_member de 20261009130000_core_team (mismos parámetros).
-- =============================================================================

create or replace function core.update_member(p_membership_id uuid, p_role text, p_status text) returns void
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

  -- Un dueño no puede cambiarle el rol ni desactivar a otro dueño.
  if v_member.role = 'owner'
     and v_member.user_id <> (select auth.uid())
     and (p_role <> 'owner' or p_status <> v_member.status) then
    perform core.raise_forbidden('owner_protected');
  end if;

  update core.memberships set role = p_role, status = p_status where id = p_membership_id;
end;
$$;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
