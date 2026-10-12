-- =============================================================================
-- CORE · Alta del cliente por QR (autoregistro). docs/ALTA-QR.md
--
-- ⚠ REQUIERE REVISIÓN DEL MENTOR ANTES DE APLICAR: junto con
--   20261011010100_loyalty_self_signup.sql agrega una función ejecutable SIN
--   SESIÓN (loyalty.self_signup). Igual que se hizo con la tarjeta (D-020).
--
-- El cliente escanea un cartel en el mostrador, pone nombre + celular, acepta
-- los términos y (si quiere) recibir mensajes por WhatsApp. El cajero no carga nada.
--
-- Lo que aporta el núcleo (la tarjeta la crea loyalty):
--   * core.self_signup_settings: interruptor por negocio (apagado por defecto) y
--     código público del cartel (10 caracteres al azar, no se adivina; el slug sí).
--   * core.self_signups: cada alta o intento. Sirve para el límite de intentos
--     (30 por hora por negocio) y como lista de avisos para el equipo cuando
--     alguien que ya era cliente se quiso anotar otra vez.
--   * core.self_signup_customer(): función INTERNA (nadie la puede llamar desde la
--     API) que crea el cliente y su consentimiento con fuente 'self_signup'.
--     Si el teléfono ya existe NO toca al cliente existente (ni su consentimiento):
--     no hay forma de saber que quien escribe es el dueño de ese número.
-- Migración no destructiva: tablas nuevas, un valor nuevo permitido en
-- customer_consents.source y funciones nuevas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Consentimientos: nueva fuente 'self_signup' (el cliente lo marcó él mismo).
-- -----------------------------------------------------------------------------
alter table core.customer_consents drop constraint customer_consents_source_check;
alter table core.customer_consents add constraint customer_consents_source_check
  check (source in ('counter', 'customer_app', 'import', 'reply_opt_out', 'admin', 'self_signup'));

-- -----------------------------------------------------------------------------
-- Configuración del alta por QR (una fila por negocio; se crea al activarla)
-- -----------------------------------------------------------------------------
create table core.self_signup_settings (
  business_id uuid primary key references core.businesses (id) on delete restrict,
  enabled     boolean not null default false,
  -- Sin 0/O/1/I para que no se confunda si alguien lo escribe a mano.
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger self_signup_settings_updated_at before update on core.self_signup_settings
  for each row execute function core.set_updated_at();
create trigger self_signup_settings_audit after insert or update on core.self_signup_settings
  for each row execute function core.audit_row();

-- -----------------------------------------------------------------------------
-- Altas e intentos. outcome = 'existing' + resolved_at null = aviso pendiente.
-- -----------------------------------------------------------------------------
create table core.self_signups (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references core.businesses (id) on delete restrict,
  customer_id       uuid not null,
  outcome           text not null check (outcome in ('created', 'existing')),
  -- Lo que escribió la persona (en un intento repetido puede no coincidir con la ficha).
  name_given        text not null check (char_length(name_given) between 1 and 60),
  whatsapp_opt_in   boolean not null,
  terms_accepted_at timestamptz not null,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references auth.users (id) on delete set null,
  unique (business_id, id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict
);

create index self_signups_business_idx on core.self_signups (business_id, created_at desc);
create index self_signups_pending_idx on core.self_signups (business_id, created_at desc)
  where outcome = 'existing' and resolved_at is null;
create index self_signups_customer_idx on core.self_signups (business_id, customer_id);
create index self_signups_resolved_by_idx on core.self_signups (resolved_by) where resolved_by is not null;

-- Si se anonimiza al cliente, también se borra el nombre que escribió.
create function core.self_signups_forget_name() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update core.self_signups set name_given = 'Anónimo'
   where business_id = new.business_id and customer_id = new.id;
  return null;
end;
$$;

create trigger customers_forget_self_signup_name
  after update of anonymized_at on core.customers
  for each row when (new.anonymized_at is not null and old.anonymized_at is null)
  execute function core.self_signups_forget_name();

-- -----------------------------------------------------------------------------
-- RLS: todo el equipo ve la configuración (el código está en un cartel público)
-- y los avisos. Nadie escribe directo: solo por funciones.
-- -----------------------------------------------------------------------------
alter table core.self_signup_settings enable row level security;
alter table core.self_signups enable row level security;

grant select on core.self_signup_settings, core.self_signups to authenticated;

create policy self_signup_settings_select on core.self_signup_settings
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

create policy self_signups_select on core.self_signups
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

-- -----------------------------------------------------------------------------
-- Código público del cartel (50 bits al azar: no se puede adivinar probando).
-- -----------------------------------------------------------------------------
create function core.new_self_signup_code() returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code  text;
begin
  for attempt in 1..20 loop
    v_bytes := extensions.gen_random_bytes(10);
    select string_agg(substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1), '' order by i)
      into v_code from generate_series(0, 9) i;
    if not exists (select 1 from core.self_signup_settings where code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code' using errcode = '55000';
end;
$$;

-- Lo que escribe la persona: mayúsculas, sin espacios ni guiones.
create function core.normalize_self_signup_code(p_code text) returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- Panel: activar/desactivar (solo dueño/admin). La primera vez crea el código.
-- -----------------------------------------------------------------------------
create function core.set_self_signup(p_business_id uuid, p_enabled boolean)
returns core.self_signup_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings core.self_signup_settings;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if p_enabled is null then
    raise exception 'enabled is required' using errcode = '22023';
  end if;
  insert into core.self_signup_settings (business_id, enabled, code)
  values (p_business_id, p_enabled, core.new_self_signup_code())
  on conflict (business_id) do update set enabled = excluded.enabled
  returning * into v_settings;
  return v_settings;
end;
$$;

-- Cambiar el código (por ejemplo, si alguien está usando el link para molestar).
-- El cartel viejo deja de funcionar: hay que imprimir uno nuevo.
create function core.rotate_self_signup_code(p_business_id uuid)
returns core.self_signup_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings core.self_signup_settings;
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  update core.self_signup_settings set code = core.new_self_signup_code()
   where business_id = p_business_id
  returning * into v_settings;
  if not found then
    raise exception 'self signup not configured' using errcode = 'P0002';
  end if;
  return v_settings;
end;
$$;

-- Marcar un aviso como resuelto (cualquier miembro del equipo).
create function core.resolve_self_signup_notice(p_notice_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notice core.self_signups;
begin
  select * into v_notice from core.self_signups where id = p_notice_id for update;
  if not found then
    raise exception 'notice not found' using errcode = 'P0002';
  end if;
  perform core.require_member(v_notice.business_id);
  if v_notice.resolved_at is null then
    update core.self_signups set resolved_at = now(), resolved_by = (select auth.uid())
     where id = p_notice_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- INTERNAS (sin grant: solo las llaman otras funciones security definer, como
-- loyalty.self_signup). No validan sesión porque las llama alguien sin sesión.
-- -----------------------------------------------------------------------------

-- Negocio de un código de cartel, solo si el alta está activada y el negocio activo.
create function core.self_signup_business(p_code text) returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.business_id
    from core.self_signup_settings s
    join core.businesses b on b.id = s.business_id
   where s.code = core.normalize_self_signup_code(p_code)
     and s.enabled
     and b.status = 'active'
$$;

-- Crea el cliente + su consentimiento de WhatsApp con fuente 'self_signup'.
-- Devuelve {status, customer_id?}. status:
--   created        cliente nuevo (customer_id)
--   existing       ya había un cliente con ese teléfono: no se cambia NADA de su
--                  ficha ni de su consentimiento; queda un aviso para el equipo
--   rate_limited   más de 30 altas/intentos en la última hora en este negocio
--   unavailable    el alta está apagada
--   invalid_name | invalid_phone | terms_required
-- No lanza errores para estos casos (un error desharía el registro del intento,
-- y el límite dejaría de contar).
create function core.self_signup_customer(
  p_business_id    uuid,
  p_name           text,
  p_phone          text,
  p_terms_accepted boolean,
  p_whatsapp       boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit  constant integer := 30;
  v_name   text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_settings core.self_signup_settings;
  v_customer_id uuid;
  v_recent integer;
begin
  if coalesce(p_terms_accepted, false) is not true then
    return jsonb_build_object('status', 'terms_required');
  end if;
  if char_length(v_name) not between 2 and 60 or v_name ~ '[[:cntrl:]<>]' then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  -- Bloquear la configuración serializa las altas del negocio: el límite no se
  -- puede pasar mandando muchas a la vez.
  select * into v_settings from core.self_signup_settings
   where business_id = p_business_id for update;
  if not found or not v_settings.enabled then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select count(*) into v_recent from core.self_signups
   where business_id = p_business_id and created_at > now() - interval '1 hour';
  if v_recent >= v_limit then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into core.customers (business_id, name, phone, source)
  values (p_business_id, v_name, v_phone, 'qr')
  on conflict (business_id, phone) where phone is not null do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select id into v_customer_id from core.customers
     where business_id = p_business_id and phone = v_phone;
    insert into core.self_signups (business_id, customer_id, outcome, name_given, whatsapp_opt_in,
                                   terms_accepted_at)
    values (p_business_id, v_customer_id, 'existing', v_name, coalesce(p_whatsapp, false), now());
    return jsonb_build_object('status', 'existing');
  end if;

  insert into core.customer_consents (business_id, customer_id, channel, purpose, granted, source)
  values (p_business_id, v_customer_id, 'whatsapp', 'marketing', coalesce(p_whatsapp, false),
          'self_signup');
  insert into core.self_signups (business_id, customer_id, outcome, name_given, whatsapp_opt_in,
                                 terms_accepted_at)
  values (p_business_id, v_customer_id, 'created', v_name, coalesce(p_whatsapp, false), now());
  perform core.emit_event(p_business_id, 'customer.self_signed_up',
                          jsonb_build_object('customer_id', v_customer_id));
  return jsonb_build_object('status', 'created', 'customer_id', v_customer_id);
end;
$$;

grant execute on function
  core.set_self_signup(uuid, boolean),
  core.rotate_self_signup_code(uuid),
  core.resolve_self_signup_notice(uuid)
to authenticated;

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
