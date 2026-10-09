-- =============================================================================
-- CORE · Importación de clientes en lote (TASKS.md §19).
-- El navegador lee y valida el CSV; la base vuelve a validar todo y decide.
-- =============================================================================

-- Importa hasta 500 clientes por llamada. Cada fila: {name, phone?, email?, notes?}.
-- Las filas inválidas o duplicadas se saltean (no frenan el resto) y se informan.
-- Devuelve {"inserted": n, "skipped": [{"index": i, "reason": "..."}]} (index desde 0).
create function core.import_customers(p_business_id uuid, p_rows jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row      jsonb;
  v_index    integer;
  v_name     text;
  v_phone    text;
  v_email    text;
  v_notes    text;
  v_inserted integer := 0;
  v_skipped  jsonb := '[]'::jsonb;
  v_reason   text;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be a json array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'at most 500 rows per call' using errcode = '54000';
  end if;

  for v_row, v_index in
    select value, (ordinality - 1)::int from jsonb_array_elements(p_rows) with ordinality
  loop
    v_reason := null;
    v_name  := nullif(btrim(coalesce(v_row ->> 'name', '')), '');
    v_phone := nullif(btrim(coalesce(v_row ->> 'phone', '')), '');
    v_email := lower(nullif(btrim(coalesce(v_row ->> 'email', '')), ''));
    v_notes := nullif(btrim(coalesce(v_row ->> 'notes', '')), '');

    if v_name is null or char_length(v_name) > 120 then
      v_reason := 'invalid_name';
    elsif v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
      v_reason := 'invalid_phone';
    elsif v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_reason := 'invalid_email';
    elsif v_phone is not null and exists (
      select 1 from core.customers where business_id = p_business_id and phone = v_phone
    ) then
      v_reason := 'duplicate_phone';
    elsif v_email is not null and exists (
      select 1 from core.customers where business_id = p_business_id and email = v_email
    ) then
      v_reason := 'duplicate_email';
    end if;

    if v_reason is null then
      begin
        insert into core.customers (business_id, name, phone, email, notes, source, created_by)
        values (p_business_id, v_name, v_phone, v_email, left(v_notes, 2000), 'import',
                (select auth.uid()));
        v_inserted := v_inserted + 1;
      exception
        when unique_violation then v_reason := 'duplicate';
        when check_violation then v_reason := 'invalid';
      end;
    end if;

    if v_reason is not null then
      v_skipped := v_skipped || jsonb_build_object('index', v_index, 'reason', v_reason);
    end if;
  end loop;

  if v_inserted > 0 then
    perform core.emit_event(p_business_id, 'customers.imported',
                            jsonb_build_object('inserted', v_inserted,
                                               'skipped', jsonb_array_length(v_skipped)));
  end if;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

grant execute on function core.import_customers(uuid, jsonb) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
