-- =============================================================================
-- LOYALTY · Plantillas de programa por rubro (D-032). docs/ALTA-QR.md
--
-- Separadas de la migración del alta por QR: no tienen nada para usuarios sin
-- sesión, así que se aplican sin esperar la revisión del mentor.
-- loyalty.apply_template(negocio, rubro, pisar): arma regla + 2 recompensas.
--   No pisa un programa que ya tiene movimientos salvo p_overwrite = true.
-- Migración no destructiva: una columna nueva (programs.template) y funciones.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Plantillas por rubro
-- -----------------------------------------------------------------------------
alter table loyalty.programs
  add column template text check (template in
    ('cafeteria', 'heladeria', 'panaderia', 'barberia', 'petshop', 'otro'));

comment on column loyalty.programs.template is
  'Plantilla con la que se armó el programa (para sugerir el titular del cartel). Solo la escribe apply_template.';

-- Catálogo de plantillas (fuente única: el panel lo lee con list_templates).
-- amountStepMinor en centavos: 500000 = $5.000.
create function loyalty.template_catalog() returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $json$[
    {"kind": "cafeteria", "label": "Cafetería",
     "headline": "Sumate al club: tu 9.º café es gratis",
     "summary": "8 cafés y el 9.º va de regalo",
     "program": {"kind": "stamps", "pointsPerVisit": 1, "pointsPerAmount": 0, "amountStepMinor": null},
     "rewards": [
       {"name": "Café de regalo", "description": "8 cafés y el 9.º va de regalo", "costPoints": 8},
       {"name": "Café con 2 medialunas de regalo", "description": "Con 15 sellos te invitamos el desayuno", "costPoints": 15}]},
    {"kind": "heladeria", "label": "Heladería",
     "headline": "Sumate al club: tu 7.º helado es gratis",
     "summary": "6 helados y el 7.º va de regalo",
     "program": {"kind": "stamps", "pointsPerVisit": 1, "pointsPerAmount": 0, "amountStepMinor": null},
     "rewards": [
       {"name": "Cucurucho de regalo", "description": "6 helados y el 7.º va de regalo", "costPoints": 6},
       {"name": "1/4 kg de helado de regalo", "description": "Con 12 sellos te llevás un cuarto", "costPoints": 12}]},
    {"kind": "panaderia", "label": "Panadería",
     "headline": "Sumate al club: con 10 compras, media docena de facturas gratis",
     "summary": "10 compras y la media docena de facturas va de regalo",
     "program": {"kind": "stamps", "pointsPerVisit": 1, "pointsPerAmount": 0, "amountStepMinor": null},
     "rewards": [
       {"name": "Media docena de facturas de regalo", "description": "10 compras y la media docena va de regalo", "costPoints": 10},
       {"name": "Docena de facturas de regalo", "description": "Con 18 sellos, una docena entera", "costPoints": 18}]},
    {"kind": "barberia", "label": "Barbería / peluquería",
     "headline": "Sumate al club: tu 6.º corte es gratis",
     "summary": "5 cortes y el 6.º va de regalo",
     "program": {"kind": "stamps", "pointsPerVisit": 1, "pointsPerAmount": 0, "amountStepMinor": null},
     "rewards": [
       {"name": "Arreglo de barba o lavado de regalo", "description": "Con 3 sellos, un arreglo de barba o un lavado", "costPoints": 3},
       {"name": "Corte de regalo", "description": "5 cortes y el 6.º va de regalo", "costPoints": 5}]},
    {"kind": "petshop", "label": "Petshop",
     "headline": "Sumate al club: regalos para tu mascota",
     "summary": "1 punto por compra + 1 cada $5.000; con 10 puntos, un snack de regalo",
     "program": {"kind": "points", "pointsPerVisit": 1, "pointsPerAmount": 1, "amountStepMinor": 500000},
     "rewards": [
       {"name": "Snack para tu mascota de regalo", "description": "Con 10 puntos te llevás un snack", "costPoints": 10},
       {"name": "Juguete de regalo", "description": "Con 25 puntos elegís un juguete", "costPoints": 25}]},
    {"kind": "otro", "label": "Otro rubro",
     "headline": "Sumate al club: cada 10 visitas, un regalo",
     "summary": "10 visitas y la próxima tiene regalo",
     "program": {"kind": "stamps", "pointsPerVisit": 1, "pointsPerAmount": 0, "amountStepMinor": null},
     "rewards": [
       {"name": "Sorpresa de la casa", "description": "Con 5 sellos te damos una sorpresa", "costPoints": 5},
       {"name": "Regalo de la casa", "description": "10 visitas y la próxima tiene regalo", "costPoints": 10}]}
  ]$json$::jsonb
$$;

-- Para el panel (cualquier miembro): el catálogo en sí no tiene grant.
create function loyalty.list_templates() returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select loyalty.template_catalog()
$$;

-- Aplica una plantilla: regla del programa + 2 recompensas (las recompensas
-- activas anteriores se desactivan, no se borran). Solo dueño/admin.
create function loyalty.apply_template(p_business_id uuid, p_kind text, p_overwrite boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template jsonb;
  v_program  jsonb;
  v_reward   jsonb;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  perform loyalty.require_module(p_business_id);

  select t into v_template from jsonb_array_elements(loyalty.template_catalog()) t
   where t ->> 'kind' = p_kind;
  if v_template is null then
    raise exception 'invalid template' using errcode = '22023';
  end if;

  -- Serializa con otros cambios del programa del mismo negocio.
  perform 1 from loyalty.programs where business_id = p_business_id for update;
  if not coalesce(p_overwrite, false)
     and exists (select 1 from loyalty.ledger where business_id = p_business_id) then
    raise exception 'program_has_activity: the program already has point movements; pass p_overwrite to replace it'
      using errcode = '22023';
  end if;

  v_program := v_template -> 'program';
  insert into loyalty.programs (business_id, enabled, kind, points_per_visit, points_per_amount,
                                amount_step_minor, min_amount_minor, template)
  values (p_business_id, true, v_program ->> 'kind', (v_program ->> 'pointsPerVisit')::int,
          (v_program ->> 'pointsPerAmount')::int, (v_program ->> 'amountStepMinor')::bigint, 0, p_kind)
  on conflict (business_id) do update
    set enabled = true, kind = excluded.kind, points_per_visit = excluded.points_per_visit,
        points_per_amount = excluded.points_per_amount, amount_step_minor = excluded.amount_step_minor,
        min_amount_minor = 0, template = excluded.template;

  update loyalty.rewards set active = false where business_id = p_business_id and active;
  for v_reward in select r from jsonb_array_elements(v_template -> 'rewards') r loop
    insert into loyalty.rewards (business_id, name, description, cost_points)
    values (p_business_id, v_reward ->> 'name', v_reward ->> 'description',
            (v_reward ->> 'costPoints')::int);
  end loop;

  return v_template;
end;
$$;

grant execute on function
  loyalty.list_templates(),
  loyalty.apply_template(uuid, text, boolean)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
