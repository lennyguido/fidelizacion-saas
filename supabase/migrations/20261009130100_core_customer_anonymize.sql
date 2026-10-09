-- =============================================================================
-- CORE · Borrar los datos personales de un cliente (Ley 25.326, derecho de supresión).
--
-- No borra la fila ni sus visitas: así las estadísticas del negocio no se rompen.
-- Reemplaza los datos personales, corta el vínculo con su cuenta de cliente, lo
-- archiva y limpia los datos personales que hayan quedado en la auditoría.
-- Es irreversible. Solo owner/admin.
-- =============================================================================

create function core.anonymize_customer(p_customer_id uuid) returns core.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
  v_personal constant text[] := array['name', 'phone', 'email', 'birthdate', 'notes', 'tags'];
begin
  select * into v_customer from core.customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_customer.business_id, array['owner', 'admin']);
  if v_customer.anonymized_at is not null then
    raise exception 'customer already anonymized' using errcode = '22023';
  end if;

  update core.customers
     set name = 'Cliente anónimo',
         phone = null,
         email = null,
         birthdate = null,
         notes = null,
         tags = '{}',
         status = 'archived',
         anonymized_at = now()
   where id = p_customer_id
  returning * into v_customer;

  delete from core.customer_accounts where customer_id = p_customer_id;

  -- La auditoría guarda valores anteriores: se quitan los datos personales.
  update core.audit_log
     set old_data = old_data - v_personal,
         new_data = new_data - v_personal
   where business_id = v_customer.business_id
     and table_name = 'core.customers'
     and record_id = p_customer_id::text;

  perform core.emit_event(v_customer.business_id, 'customer.anonymized',
                          jsonb_build_object('customer_id', p_customer_id));
  return v_customer;
end;
$$;

grant execute on function core.anonymize_customer(uuid) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
