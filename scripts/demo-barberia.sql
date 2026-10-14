-- =============================================================================
-- Barbería de prueba para Neriva Turnos (solo para el proyecto de DESARROLLO).
--
-- Crea "Barbería Sol (DEMO)" con 3 barberos, 4 servicios, horarios de martes a
-- sábado, 40 clientes y 4 meses de turnos (vinieron, faltaron, cancelaron), más
-- turnos para los próximos días con algunos huecos libres. 15 clientes dejaron de
-- venir hace 1 a 3 meses, para probar "Llenar huecos".
--
-- Los celulares son inventados (+54 9 11 0000-xxxx): no son de nadie real.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo → cambiar el email de la línea
-- marcada con 👉 por el email con el que entrás al panel → Run.
-- Se puede correr más de una vez: cada vez crea una barbería nueva.
-- =============================================================================
do $$
declare
  v_email    text := 'TU_EMAIL@ejemplo.com';  -- 👉 cambiá esto
  v_tz       constant text := 'America/Argentina/Buenos_Aires';
  v_today    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_owner    uuid;
  v_biz      uuid;
  v_slug     text;
  v_staff    uuid[];
  v_services uuid[];
  v_prices   bigint[] := array[1200000, 1600000, 800000, 2500000];
  v_minutes  int[] := array[30, 45, 20, 60];
  v_names    constant text[] := array[
    'Martín Díaz', 'Lucas Romero', 'Nicolás Acosta', 'Tomás Herrera', 'Matías Ríos',
    'Santiago Ortiz', 'Lautaro Rojas', 'Facundo Vega', 'Federico Paz', 'Joaquín Luna',
    'Juan Pérez', 'Diego Sosa', 'Bruno Medina', 'Franco Castro', 'Gonzalo Ruiz',
    'Iván Molina', 'Leandro Silva', 'Maximiliano Núñez', 'Pablo Ibáñez', 'Ramiro Benítez',
    'Emiliano Torres', 'Ezequiel López', 'Agustín Gómez', 'Thiago Suárez', 'Valentín Rey',
    -- Del 26 al 40: dejaron de venir (para "Llenar huecos").
    'Fede Martínez', 'Hernán Giménez', 'Sergio Aguirre', 'Alan Cabrera', 'Kevin Ponce',
    'Marcos Vera', 'Cristian Godoy', 'Daniel Ojeda', 'Ariel Quiroga', 'Rodrigo Ferreyra',
    'Mauro Correa', 'Lisandro Paz', 'Julián Figueroa', 'Gastón Peralta', 'Andrés Luna'];
  v_customers uuid[] := '{}';
  v_customer uuid;
  v_day      date;
  v_hour     int;
  v_st       int;
  v_sv       int;
  v_chance   numeric;
  v_status   text;
  v_start    timestamptz;
  v_roll     numeric;
  i          int;
begin
  select id into v_owner from auth.users where lower(email) = lower(btrim(v_email));
  if v_owner is null then
    raise exception 'No encontré un usuario con el email %. Cambiá la línea marcada con 👉.', v_email;
  end if;
  perform setseed(0.42);

  -- Negocio, sucursal, dueño y plan Turnos.
  v_slug := 'barberia-sol-demo-' || lower(encode(extensions.gen_random_bytes(2), 'hex'));
  insert into core.businesses (name, slug, timezone, settings)
  values ('Barbería Sol (DEMO)', v_slug, v_tz, jsonb_build_object('demo', true))
  returning id into v_biz;
  insert into core.locations (business_id, name) values (v_biz, 'Principal');
  insert into core.memberships (business_id, user_id, role) values (v_biz, v_owner, 'owner');
  insert into core.subscriptions (business_id, plan_id, status) values (v_biz, 'turnos', 'active');
  insert into core.business_modules (business_id, module_id)
  select v_biz, module_id from core.plan_modules where plan_id = 'turnos';

  -- Turnos online prendidos.
  insert into booking.settings (business_id, enabled, slot_minutes, min_notice_minutes,
                                max_days_ahead, message)
  values (v_biz, true, 30, 60, 30, 'Te esperamos en Av. Siempreviva 742. ¡Llegá 5 minutos antes!');

  insert into booking.services (business_id, name, duration_minutes, price_minor, sort)
  select v_biz, n, m, p, s
    from unnest(array['Corte', 'Corte y barba', 'Barba', 'Color'], v_minutes, v_prices,
                array[1, 2, 3, 4]) as t(n, m, p, s);
  select array_agg(id order by sort) into v_services from booking.services where business_id = v_biz;

  insert into booking.staff (business_id, name, sort)
  select v_biz, n, s from unnest(array['Juan', 'Mati', 'Lucho'], array[1, 2, 3]) as t(n, s);
  select array_agg(id order by sort) into v_staff from booking.staff where business_id = v_biz;

  -- Martes a viernes de 10 a 20; sábados de 10 a 18.
  insert into booking.hours (business_id, staff_id, weekday, start_time, end_time)
  select v_biz, st, d, '10:00', case when d = 6 then time '18:00' else time '20:00' end
    from unnest(v_staff) st, generate_series(2, 6) d;

  -- Clientes. 70 % aceptó promociones por WhatsApp al reservar.
  for i in 1 .. array_length(v_names, 1) loop
    insert into core.customers (business_id, name, phone, source)
    values (v_biz, v_names[i], '+54911' || lpad((i)::text, 8, '0'), 'booking')
    returning id into v_customer;
    v_customers := v_customers || v_customer;
    if random() < 0.7 then
      insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
      values (v_biz, v_customer, 'whatsapp', 'marketing', true, 'customer_app');
    end if;
  end loop;

  -- Turnos: de hace 120 días hasta dentro de 7, cada barbero en bloques de 1 hora.
  for v_day in select generate_series(v_today - 120, v_today + 7, interval '1 day')::date loop
    continue when extract(dow from v_day) not between 2 and 6;
    for v_st in 1 .. 3 loop
      for v_hour in 10 .. (case when extract(dow from v_day) = 6 then 17 else 19 end) loop
        v_start := (v_day + make_time(v_hour, 0, 0)) at time zone v_tz;
        v_chance := case
          when v_day < v_today then 0.6
          when v_day = v_today then 0.5
          else greatest(0.15, 0.55 - (v_day - v_today) * 0.06)  -- más huecos cuanto más lejos
        end;
        continue when random() > v_chance;

        -- Los que dejaron de venir (26 a 40) solo aparecen hasta hace 35 días.
        if v_day < v_today - 35 and random() < 0.35 then
          v_customer := v_customers[26 + floor(random() * 15)::int];
        else
          v_customer := v_customers[1 + floor(random() * 25)::int];
        end if;
        v_sv := case when random() < 0.45 then 1 when random() < 0.6 then 2
                     when random() < 0.7 then 3 else 4 end;

        if v_start < now() then
          v_roll := random();
          v_status := case when v_roll < 0.88 then 'attended'
                           when v_roll < 0.95 then 'no_show' else 'cancelled' end;
        else
          v_status := 'booked';
        end if;

        insert into booking.appointments (business_id, staff_id, service_id, customer_id,
                                          starts_at, ends_at, status, source, token_hash,
                                          price_minor, cancelled_at, created_at)
        values (v_biz, v_staff[v_st], v_services[v_sv], v_customer, v_start,
                v_start + make_interval(mins => v_minutes[v_sv]), v_status,
                case when random() < 0.7 then 'online' else 'panel' end,
                core.hash_token(gen_random_uuid()::text || gen_random_uuid()::text),
                v_prices[v_sv],
                case when v_status = 'cancelled' then v_start - interval '1 day' end,
                least(now(), v_start - interval '3 days'));
      end loop;
    end loop;
  end loop;

  raise notice 'Listo: Barbería Sol (DEMO). Página de reservas: https://turnos.neriva.net/%', v_slug;
end;
$$;
