-- =============================================================================
-- CORE · Borrar datos personales: cubrir lo que se agregó después de la primera
-- versión (Ley 25.326, derecho de supresión).
--
-- La función original se escribió antes de: cumpleaños (birth_day/birth_month),
-- opiniones (core.feedback), alta por QR (core.self_signups) y mensajes
-- automáticos (core.outbox). Esta versión también borra esos datos.
-- Misma firma, mismos permisos (solo owner/admin). Es irreversible.
-- =============================================================================

create or replace function core.anonymize_customer(p_customer_id uuid) returns core.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer core.customers;
  v_personal constant text[] := array['name', 'phone', 'email', 'birthdate',
                                      'birth_day', 'birth_month', 'notes', 'tags'];
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
         birth_day = null,
         birth_month = null,
         notes = null,
         tags = '{}',
         status = 'archived',
         anonymized_at = now()
   where id = p_customer_id
  returning * into v_customer;

  delete from core.customer_accounts where customer_id = p_customer_id;

  -- Texto libre de las visitas (notas, motivo de anulación).
  update core.visits
     set notes = null,
         void_reason = case when void_reason is not null then '(dato borrado)' end
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and (notes is not null or void_reason is not null);

  -- Mensajes ya armados con su nombre (campañas y automáticos).
  update core.campaign_recipients
     set message = null
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and message is not null;

  update core.outbox
     set message = '(dato borrado)',
         error = null
   where business_id = v_customer.business_id
     and customer_id = p_customer_id;

  -- Comentarios de las opiniones (la nota queda para las estadísticas).
  update core.feedback
     set comment = null
   where business_id = v_customer.business_id
     and customer_id = p_customer_id
     and comment is not null;

  -- Lo que escribió en el alta por QR.
  update core.self_signups
     set name_given = 'Cliente anónimo'
   where business_id = v_customer.business_id
     and customer_id = p_customer_id;

  -- Auditoría: quitar los datos personales guardados como valores anteriores.
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

  update core.audit_log a
     set old_data = a.old_data - array['comment', 'name_given', 'message'],
         new_data = a.new_data - array['comment', 'name_given', 'message']
   where a.business_id = v_customer.business_id
     and a.table_name in ('core.feedback', 'core.self_signups', 'core.outbox')
     and coalesce(a.new_data, a.old_data) ->> 'customer_id' = p_customer_id::text;

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

revoke execute on all functions in schema core from public, anon;
