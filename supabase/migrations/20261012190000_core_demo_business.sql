-- =============================================================================
-- CORE + LOYALTY · "Armar demo" para salir a vender (D-045, no destructivo).
--
-- Solo el administrador de la plataforma. Crea un negocio de demostración con el
-- nombre del local que va a visitar, con datos inventados que muestran todo:
--   * ~24 clientes con 3 meses de visitas (habituales, en riesgo, nuevos,
--     uno que cumple hoy), WhatsApp aceptado en la mayoría;
--   * una campaña de hace 20 días con resultados ("plata que volvió");
--   * recuperación automática prendida y los mensajes de hoy listos;
--   * alta por QR activada (para que el dueño escanee el cartel con su celular).
-- loyalty.seed_demo(negocio, rubro) arma el programa de la plantilla del rubro y
-- suma a los clientes como socios con sellos.
-- Los negocios de demo quedan marcados en settings.demo = true.
-- =============================================================================

create function core.create_demo_business(p_name text) returns core.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := (select auth.uid());
  v_name      text := btrim(coalesce(p_name, ''));
  v_base      text;
  v_slug      text;
  v_business  core.businesses;
  v_location  uuid;
  v_tz        constant text := 'America/Argentina/Buenos_Aires';
  v_today     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_names     constant text[] := array[
    'Ana Gómez', 'Carlos Ruiz', 'Lucía Pérez', 'Martín Díaz', 'Sofía López', 'Julián Torres',
    'Valentina Romero', 'Diego Sosa', 'Camila Benítez', 'Nicolás Acosta', 'Florencia Medina',
    'Tomás Herrera', 'Agustina Castro', 'Matías Ríos', 'Paula Molina', 'Santiago Ortiz',
    'Micaela Silva', 'Lautaro Rojas', 'Julieta Núñez', 'Facundo Vega', 'Rocío Ibáñez',
    'Federico Paz', 'Milagros Ruiz', 'Joaquín Luna'];
  v_customer  uuid;
  v_kind      text;
  v_last      integer;
  v_interval  integer;
  v_count     integer;
  v_campaign  uuid;
  i           integer;
  j           integer;
begin
  perform core.require_platform_admin();
  if char_length(v_name) not between 2 and 80 then
    raise exception 'name is required' using errcode = '22023';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(translate(v_name,
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'));
  v_slug := left('demo-' || coalesce(nullif(v_base, ''), 'local'), 40)
            || '-' || lower(encode(extensions.gen_random_bytes(2), 'hex'));

  insert into core.businesses (name, slug, timezone, settings)
  values (v_name, v_slug, v_tz, jsonb_build_object('demo', true))
  returning * into v_business;
  insert into core.locations (business_id, name) values (v_business.id, 'Principal')
  returning id into v_location;
  insert into core.memberships (business_id, user_id, role) values (v_business.id, v_user_id, 'owner');
  insert into core.subscriptions (business_id, plan_id, status) values (v_business.id, 'pilot', 'active');
  insert into core.business_modules (business_id, module_id)
  select v_business.id, module_id from core.plan_modules where plan_id = 'pilot';

  -- Clientes: 0-13 habituales, 14-18 en riesgo, 19-21 nuevos (una visita hace 10 días),
  -- 22 cumple hoy (habitual), 23 inactivo.
  for i in 1 .. array_length(v_names, 1) loop
    v_kind := case
      when i <= 14 then 'regular' when i <= 19 then 'risk'
      when i <= 22 then 'new' when i = 23 then 'birthday' else 'inactive' end;
    insert into core.customers (business_id, name, phone, source, birth_day, birth_month)
    values (v_business.id, v_names[i], '+549110000' || lpad(i::text, 4, '0'), 'import',
            case when v_kind = 'birthday' then extract(day from v_today)::smallint end,
            case when v_kind = 'birthday' then extract(month from v_today)::smallint end)
    returning id into v_customer;

    -- En riesgo = entre 1,5 y 3 veces su intervalo sin venir (y más de 14 días, para el automático).
    v_interval := case when v_kind = 'risk' then 7 + (i % 3) else 5 + (i % 5) end;
    v_last := case v_kind
      when 'regular' then i % 4 when 'birthday' then 2
      when 'risk' then floor(v_interval * 2.6)::int when 'new' then 10 else 75 end;
    v_count := case v_kind when 'new' then 1 when 'inactive' then 3 else 6 + (i % 6) end;
    for j in 0 .. v_count - 1 loop
      insert into core.visits (business_id, location_id, customer_id, occurred_at, amount_minor,
                               currency, source)
      values (v_business.id, v_location, v_customer,
              now() - make_interval(days => v_last + j * v_interval, hours => 10 + (j % 8)),
              (3500 + ((i * 37 + j * 53) % 9) * 650) * 100, 'ARS', 'import');
    end loop;
    perform core.refresh_customer_stats(v_customer, 'import');

    if i % 6 <> 0 then
      insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source,
                                          recorded_at)
      values (v_business.id, v_customer, 'whatsapp', 'marketing', true, 'counter', now() - interval '100 days');
    end if;
  end loop;

  -- Visitas anónimas de los últimos días (las estadísticas cuentan todo).
  for j in 0 .. 29 loop
    insert into core.visits (business_id, location_id, occurred_at, amount_minor, currency, source)
    values (v_business.id, v_location, now() - make_interval(days => j % 14, hours => 9 + (j % 9)),
            (2500 + (j % 7) * 700) * 100, 'ARS', 'import');
  end loop;

  -- Campaña de hace 20 días, con grupo de control: muestra "plata que volvió".
  insert into core.campaigns (business_id, module_id, name, segment, message, benefit, control_pct,
                              attribution_days, status, sent_at, recipients_count)
  values (v_business.id, 'recovery', 'Te extrañamos', '{"statuses":["AT_RISK"]}',
          '¡Hola {nombre}! Te esperamos en {negocio} con {beneficio}.', 'un café de regalo', 20, 14,
          'sent', now() - interval '20 days', 10)
  returning id into v_campaign;
  insert into core.campaign_recipients (business_id, campaign_id, customer_id, is_control,
                                        status_at_send, message, contacted_at)
  select v_business.id, v_campaign, c.id, c.n > 8, 'AT_RISK',
         case when c.n > 8 then null else '¡Hola! Te esperamos.' end,
         case when c.n > 8 then null else now() - interval '20 days' end
    from (select id, row_number() over (order by created_at) as n
            from core.customers where business_id = v_business.id
           order by created_at limit 10) c;

  -- Recuperación automática prendida y alta por QR activada.
  insert into core.automations (business_id, kind, enabled, days, message, benefit, updated_by)
  select v_business.id, k, true, (core.automation_defaults(k) ->> 'days')::int,
         core.automation_defaults(k) ->> 'message', core.automation_defaults(k) ->> 'benefit', v_user_id
    from unnest(array['at_risk', 'second_visit', 'birthday']) k;
  insert into core.self_signup_settings (business_id, enabled, code)
  values (v_business.id, true, core.new_self_signup_code());

  perform core.refresh_statuses(v_business.id);
  perform core.run_business_automations(v_business.id);
  return v_business;
end;
$$;

-- Programa de la plantilla del rubro y clientes como socios con sellos.
create function loyalty.seed_demo(p_business_id uuid, p_kind text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member loyalty.members;
  v_row    record;
begin
  perform core.require_platform_admin();
  if not coalesce((select (settings ->> 'demo')::boolean from core.businesses where id = p_business_id), false) then
    raise exception 'not a demo business' using errcode = '22023';
  end if;
  perform loyalty.apply_template(p_business_id, p_kind, true);

  for v_row in
    select c.id, s.visit_count from core.customers c
      join core.customer_stats s on s.customer_id = c.id
     where c.business_id = p_business_id and s.visit_count > 0
  loop
    v_member := null;
    insert into loyalty.members (business_id, customer_id, member_code)
    values (p_business_id, v_row.id, loyalty.new_member_code(p_business_id))
    on conflict do nothing
    returning * into v_member;
    if v_member.id is not null then
      perform loyalty.post_movement(v_member, least(v_row.visit_count, 7)::bigint, 'adjustment',
                                    null, null, 'Demo');
    end if;
  end loop;
end;
$$;

grant execute on function core.create_demo_business(text) to authenticated;
grant execute on function loyalty.seed_demo(uuid, text) to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
revoke execute on all functions in schema loyalty from public, anon;
grant execute on function loyalty.get_card(text) to anon;
grant execute on function loyalty.self_signup(text, text, text, boolean, boolean) to anon;
