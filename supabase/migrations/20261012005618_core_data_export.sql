-- =============================================================================
-- CORE + LOYALTY · Exportar datos ("Tus clientes son tuyos", OPORTUNIDADES #9).
-- Plan de Claude Code, tarea 4. Decisión D-034.
--
--   core.export_customers(negocio)            → todos los clientes con sus números.
--   core.export_visits(negocio, desde, hasta) → visitas entre dos fechas (inclusive)
--                                               en la zona horaria del negocio.
--   loyalty.export_ledger(negocio, desde, hasta) → movimientos de puntos/sellos.
--
-- Solo dueño o admin. Cada exportación queda registrada como evento
-- `data.exported` (quién, qué, cuántas filas), igual que los demás cambios
-- auditados por función. Devuelven un único jsonb (lista de objetos) para no
-- chocar con el límite de filas de la API (max_rows = 1000). Fechas como texto
-- en la hora local del negocio. El CSV lo arma el SDK (sdk/csv.ts).
-- Solo agrega funciones: no toca tablas ni datos.
-- =============================================================================

-- Rango de fechas válido para exportar: hasta 366 días por archivo.
create function core.check_export_range(p_from date, p_to date) returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'date range too long (max 366 days)' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
create function core.export_customers(p_business_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_rows jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  select timezone into v_tz from core.businesses where id = p_business_id;

  select coalesce(jsonb_agg(row_data order by created_at), '[]'::jsonb) into v_rows
    from (
      select c.created_at,
             jsonb_build_object(
               'name', c.name,
               'phone', c.phone,
               'email', c.email,
               'birth_day', c.birth_day,
               'birth_month', c.birth_month,
               'tags', array_to_string(c.tags, ', '),
               'notes', c.notes,
               'source', c.source,
               'status', c.status,
               'anonymized', c.anonymized_at is not null,
               'whatsapp_marketing', core.whatsapp_marketing_granted(c.business_id, c.id),
               'created_at', to_char(c.created_at at time zone v_tz, 'YYYY-MM-DD HH24:MI'),
               'visit_count', coalesce(s.visit_count, 0),
               'first_visit_at', to_char(s.first_visit_at at time zone v_tz, 'YYYY-MM-DD HH24:MI'),
               'last_visit_at', to_char(s.last_visit_at at time zone v_tz, 'YYYY-MM-DD HH24:MI'),
               'total_spend_minor', coalesce(s.total_spend_minor, 0),
               'customer_status', s.status
             ) as row_data
        from core.customers c
        left join core.customer_stats s on s.customer_id = c.id and s.business_id = c.business_id
       where c.business_id = p_business_id
    ) t;

  perform core.emit_event(p_business_id, 'data.exported',
    jsonb_build_object('kind', 'customers', 'actor_id', (select auth.uid()),
                       'rows', jsonb_array_length(v_rows)));
  return v_rows;
end;
$$;

-- -----------------------------------------------------------------------------
-- Visitas
-- -----------------------------------------------------------------------------
create function core.export_visits(p_business_id uuid, p_from date, p_to date) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_rows jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform core.check_export_range(p_from, p_to);
  select timezone into v_tz from core.businesses where id = p_business_id;

  select coalesce(jsonb_agg(row_data order by occurred_at), '[]'::jsonb) into v_rows
    from (
      select v.occurred_at,
             jsonb_build_object(
               'occurred_at', to_char(v.occurred_at at time zone v_tz, 'YYYY-MM-DD HH24:MI'),
               'customer_name', c.name,
               'customer_phone', c.phone,
               'location', l.name,
               'amount_minor', v.amount_minor,
               'currency', v.currency,
               'source', v.source,
               'notes', v.notes,
               'voided', v.voided_at is not null,
               'void_reason', v.void_reason
             ) as row_data
        from core.visits v
        join core.locations l on l.business_id = v.business_id and l.id = v.location_id
        left join core.customers c on c.business_id = v.business_id and c.id = v.customer_id
       where v.business_id = p_business_id
         and v.occurred_at >= (p_from::timestamp at time zone v_tz)
         and v.occurred_at < ((p_to + 1)::timestamp at time zone v_tz)
    ) t;

  perform core.emit_event(p_business_id, 'data.exported',
    jsonb_build_object('kind', 'visits', 'actor_id', (select auth.uid()),
                       'from', p_from, 'to', p_to, 'rows', jsonb_array_length(v_rows)));
  return v_rows;
end;
$$;

grant execute on function
  core.export_customers(uuid),
  core.export_visits(uuid, date, date)
to authenticated;

-- -----------------------------------------------------------------------------
-- LOYALTY · Movimientos de puntos o sellos (solo si el módulo está activo).
-- -----------------------------------------------------------------------------
create function loyalty.export_ledger(p_business_id uuid, p_from date, p_to date) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_rows jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'loyalty') then
    raise exception 'module loyalty not active' using errcode = '42501';
  end if;
  perform core.check_export_range(p_from, p_to);
  select timezone into v_tz from core.businesses where id = p_business_id;

  select coalesce(jsonb_agg(row_data order by created_at, id), '[]'::jsonb) into v_rows
    from (
      select g.created_at, g.id,
             jsonb_build_object(
               'created_at', to_char(g.created_at at time zone v_tz, 'YYYY-MM-DD HH24:MI'),
               'customer_name', c.name,
               'customer_phone', c.phone,
               'delta', g.delta,
               'reason', g.reason,
               'reward_name', r.reward_name,
               'note', g.note
             ) as row_data
        from loyalty.ledger g
        join loyalty.members m on m.business_id = g.business_id and m.id = g.member_id
        join core.customers c on c.business_id = m.business_id and c.id = m.customer_id
        left join loyalty.redemptions r
          on r.business_id = g.business_id and r.id = g.redemption_id
       where g.business_id = p_business_id
         and g.created_at >= (p_from::timestamp at time zone v_tz)
         and g.created_at < ((p_to + 1)::timestamp at time zone v_tz)
    ) t;

  perform core.emit_event(p_business_id, 'data.exported',
    jsonb_build_object('kind', 'loyalty_ledger', 'actor_id', (select auth.uid()),
                       'from', p_from, 'to', p_to, 'rows', jsonb_array_length(v_rows)));
  return v_rows;
end;
$$;

grant execute on function loyalty.export_ledger(uuid, date, date) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
-- El alta por QR (migración 20261011010100) puede estar aplicada antes o después
-- que esta: si ya existe, se le devuelve el permiso a anon que el revoke le sacó.
do $$
begin
  if to_regprocedure('loyalty.self_signup(text,text,text,boolean,boolean)') is not null then
    grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
  end if;
end;
$$;
