-- =============================================================================
-- CORE · Archivar / reactivar clientes: solo owner o admin.
--
-- Antes, cualquier miembro (incluido staff) podía cambiar customers.status con un
-- UPDATE directo. Ahora la columna `status` no es editable desde la API y el
-- cambio pasa por una función que exige rol owner/admin (y queda auditado por el
-- trigger customers_audit).
-- =============================================================================

revoke update (status) on core.customers from authenticated;

create function core.set_customer_status(p_customer_id uuid, p_status text) returns core.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
begin
  if p_status is null or p_status not in ('active', 'archived') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  select * into v_customer from core.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;

  perform core.require_member(v_customer.business_id, array['owner', 'admin']);

  if v_customer.anonymized_at is not null then
    raise exception 'anonymized customers cannot change status' using errcode = '22023';
  end if;

  update core.customers set status = p_status where id = p_customer_id
  returning * into v_customer;

  perform core.emit_event(v_customer.business_id, 'customer.status_set',
                          jsonb_build_object('customer_id', p_customer_id, 'status', p_status));
  return v_customer;
end;
$$;

grant execute on function core.set_customer_status(uuid, text) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
