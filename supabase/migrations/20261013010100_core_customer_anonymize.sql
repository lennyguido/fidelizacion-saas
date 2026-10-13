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

  -- Las visitas tienen texto libre (notas, motivo de anulación) que puede tener
  -- datos personales. Se borra; el motivo se reemplaza porque es obligatorio
  -- en una visita anulada.
  update core.visits
     set notes = null,
         void_reason = case when void_reason is not null then '(dato borrado)' end
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and (notes is not null or void_reason is not null);

  -- El mensaje de campaña ya personalizado lleva el nombre del cliente. Se
  -- borra; el resto (grupo, estado al enviar, contactado) queda para medir.
  -- Las filas de control ya tienen message = null.
  update core.campaign_recipients
     set message = null
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and message is not null;

  -- La auditoría guarda valores anteriores: se quitan los datos personales
  -- (incluye las filas que acaba de generar el update de visitas).
  update core.audit_log
     set old_data = old_data - v_personal,
         new_data = new_data - v_personal
   where business_id = v_customer.business_id
     and table_name = 'core.customers'
     and record_id = p_customer_id::text;

  update core.audit_log a
     set old_data = a.old_data - array['notes', 'void_reason'],
         new_data = a.new_data - array['notes', 'void_reason']
   where a.business_id = v_customer.business_id
     and a.table_name = 'core.visits'
     and a.record_id in (select v.id::text from core.visits v
                          where v.business_id = v_customer.business_id
                            and v.customer_id = p_customer_id);

  -- El evento de anulación copia el motivo.
  update core.events e
     set payload = e.payload - 'reason'
   where e.business_id = v_customer.business_id
     and e.type = 'visit.voided'
     and e.payload ->> 'customer_id' = p_customer_id::text;

  perform core.emit_event(v_customer.business_id, 'customer.anonymized',
                          jsonb_build_object('customer_id', p_customer_id));
  return v_customer;
end;
$$;

grant execute on function core.anonymize_customer(uuid) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
