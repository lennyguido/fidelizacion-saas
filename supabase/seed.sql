-- =============================================================================
-- Datos DEMO (TASKS.md secciones 60–61). Solo para entornos local y de desarrollo.
-- Todo es ficticio y está marcado con settings.demo = true.
-- Fechas relativas a "ahora" para que los estados tengan sentido siempre.
-- =============================================================================

do $seed$
declare
  v_cafe     uuid;
  v_panaderia uuid;
  v_loc      uuid;
  v_customer uuid;
  r          record;
begin
  if exists (select 1 from core.businesses where slug in ('cafe-central', 'panaderia-sur')) then
    raise notice 'demo data already present: skipping';
    return;
  end if;

  -- Café Central ---------------------------------------------------------------
  insert into core.businesses (name, slug, primary_color, secondary_color, settings)
  values ('Café Central (DEMO)', 'cafe-central', '#6B3E26', '#F2E3D5', '{"demo": true}')
  returning id into v_cafe;

  insert into core.locations (business_id, name, address)
  values (v_cafe, 'Sucursal Centro', 'Av. Corrientes 1234, CABA')
  returning id into v_loc;

  insert into core.business_modules (business_id, module_id)
  select v_cafe, module_id from core.plan_modules where plan_id = 'pilot';

  insert into core.subscriptions (business_id, plan_id, status, trial_ends_at)
  values (v_cafe, 'pilot', 'trialing', now() + interval '30 days');

  -- Clientes con distintos comportamientos: nombre, teléfono, días atrás de cada visita, ticket.
  for r in
    select * from (values
      ('Ana Gómez',        '+5491100000001', array[2, 9, 16, 23, 30, 37, 44],            850000),
      ('Bruno Díaz',       '+5491100000002', array[12, 19, 26, 33, 40, 47],              620000),
      ('Carla Ruiz',       '+5491100000003', array[30, 37, 44, 51, 58],                  910000),
      ('Don Carlos',       null,             array[1, 4, 7, 10, 13, 16, 19, 22, 25],     380000),
      ('Diego Fernández',  '+5491100000005', array[14, 44, 74, 104],                     1500000),
      ('Elena Martínez',   '+5491100000006', array[3],                                   700000),
      ('Federico Sosa',    '+5491100000007', array[40, 47, 54, 61, 68],                  540000)
    ) as t(name, phone, days_ago, ticket)
  loop
    insert into core.customers (business_id, name, phone, source)
    values (v_cafe, r.name, r.phone, 'import')
    returning id into v_customer;

    insert into core.visits (business_id, location_id, customer_id, occurred_at, amount_minor, currency, source)
    select v_cafe, v_loc, v_customer, now() - make_interval(days => d), r.ticket, 'ARS', 'import'
    from unnest(r.days_ago) as d;

    perform core.refresh_customer_stats(v_customer, 'import');
  end loop;

  -- Visitas anónimas de las últimas dos semanas (clientes que no quieren identificarse).
  insert into core.visits (business_id, location_id, occurred_at, amount_minor, currency, source)
  select v_cafe, v_loc, now() - make_interval(days => d % 14, hours => d % 9), 450000, 'ARS', 'import'
  from generate_series(1, 40) as d;

  -- Panadería Sur (segundo negocio, para probar aislamiento) ---------------------
  insert into core.businesses (name, slug, primary_color, settings)
  values ('Panadería Sur (DEMO)', 'panaderia-sur', '#C8811A', '{"demo": true}')
  returning id into v_panaderia;

  insert into core.locations (business_id, name) values (v_panaderia, 'Local') returning id into v_loc;

  insert into core.business_modules (business_id, module_id)
  select v_panaderia, module_id from core.plan_modules where plan_id = 'pilot';

  for r in
    select * from (values
      ('Gabriela Paz', '+5491100000101', array[1, 3, 5, 8, 10], 250000),
      ('Hugo Ríos',    '+5491100000102', array[20, 22, 24, 27],  300000)
    ) as t(name, phone, days_ago, ticket)
  loop
    insert into core.customers (business_id, name, phone, source)
    values (v_panaderia, r.name, r.phone, 'import')
    returning id into v_customer;

    insert into core.visits (business_id, location_id, customer_id, occurred_at, amount_minor, currency, source)
    select v_panaderia, v_loc, v_customer, now() - make_interval(days => d), r.ticket, 'ARS', 'import'
    from unnest(r.days_ago) as d;

    perform core.refresh_customer_stats(v_customer, 'import');
  end loop;
end
$seed$;
