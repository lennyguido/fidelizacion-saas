-- =============================================================================
-- REPUTATION · Carteles NFC/QR de reseñas (D-048).
--
-- Cada cartel (sticker NFC + QR) lleva a neriva.net/r/<código>. Ese link cuenta
-- el toque y redirige al destino (por defecto, el link de reseñas de Google del
-- negocio). El destino se cambia sin regrabar el chip.
--
-- * reputation.tags: carteles del negocio (código, nombre, destino, activo).
-- * reputation.taps: cada toque (sin datos personales: ni IP ni dispositivo).
-- * Lectura para miembros; escritura solo por funciones (dueño/admin).
-- * reputation.resolve_tap: solo service_role (la llama la Edge Function `tap`).
-- =============================================================================

create schema if not exists reputation;
revoke all on schema reputation from public;
grant usage on schema reputation to authenticated, service_role;
alter default privileges in schema reputation grant all on tables to service_role;
alter default privileges in schema reputation grant all on sequences to service_role;
alter default privileges in schema reputation grant execute on functions to service_role;

-- El módulo pasa a estar disponible y en todos los planes (también los negocios existentes).
update core.modules set available = true where id = 'reputation';
insert into core.plan_modules (plan_id, module_id)
select id, 'reputation' from core.plans
on conflict do nothing;
insert into core.business_modules (business_id, module_id)
select id, 'reputation' from core.businesses
on conflict do nothing;

create table reputation.tags (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  code        text not null unique check (code ~ '^[a-z0-9]{6,32}$'),
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  destination text not null check (char_length(destination) <= 500 and destination ~* '^https://[^\s]+$'),
  active      boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, id)
);
create index tags_business_idx on reputation.tags (business_id, created_at);
create index tags_created_by_idx on reputation.tags (created_by) where created_by is not null;

create table reputation.taps (
  id          bigint generated always as identity primary key,
  business_id uuid not null references core.businesses (id) on delete restrict,
  tag_id      uuid not null,
  source      text not null default 'nfc' check (source in ('nfc', 'qr', 'link')),
  tapped_at   timestamptz not null default now(),
  foreign key (business_id, tag_id) references reputation.tags (business_id, id) on delete restrict
);
create index taps_business_tag_idx on reputation.taps (business_id, tag_id, tapped_at desc);

alter table reputation.tags enable row level security;
alter table reputation.taps enable row level security;
grant select on reputation.tags to authenticated;

create policy tags_select on reputation.tags
  for select to authenticated
  using (business_id in (select core.my_business_ids_with_module('reputation')));
-- taps: sin policies; se leen con reputation.tag_stats.

create trigger tags_audit after insert or update on reputation.tags
  for each row execute function core.audit_row();

-- -----------------------------------------------------------------------------
-- Funciones internas
-- -----------------------------------------------------------------------------
create function reputation.require_manager(p_business_id uuid) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform core.require_member(p_business_id, array['owner', 'admin']);
  if not core.has_module(p_business_id, 'reputation') then
    perform core.raise_forbidden('module_disabled');
  end if;
end;
$$;

create function reputation.new_code() returns text
language sql
volatile
set search_path = ''
as $$
  -- 8 caracteres sin letras confusas (sin 0/o, 1/l/i).
  select string_agg(substr('23456789abcdefghjkmnpqrstuvwxyz', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 8)
$$;

-- -----------------------------------------------------------------------------
-- Para el panel (dueño/admin)
-- -----------------------------------------------------------------------------
create function reputation.create_tag(p_business_id uuid, p_label text, p_destination text default null)
returns reputation.tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_destination text;
  v_tag reputation.tags;
begin
  perform reputation.require_manager(p_business_id);
  v_destination := nullif(btrim(coalesce(p_destination, '')), '');
  if v_destination is null then
    select google_review_url into v_destination from core.businesses where id = p_business_id;
  end if;
  if v_destination is null then
    raise exception 'destination_required' using errcode = '22023';
  end if;

  for i in 1..5 loop
    begin
      insert into reputation.tags (business_id, code, label, destination, created_by)
      values (p_business_id, reputation.new_code(), btrim(coalesce(p_label, '')), v_destination,
              (select auth.uid()))
      returning * into v_tag;
      return v_tag;
    exception when unique_violation then
      if i = 5 then raise; end if;
    end;
  end loop;
  return v_tag;
end;
$$;

create function reputation.update_tag(p_tag_id uuid, p_label text default null,
                                      p_destination text default null, p_active boolean default null)
returns reputation.tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag reputation.tags;
begin
  select * into v_tag from reputation.tags where id = p_tag_id for update;
  if not found then
    raise exception 'tag not found' using errcode = 'P0002';
  end if;
  perform reputation.require_manager(v_tag.business_id);

  update reputation.tags
     set label = btrim(coalesce(p_label, label)),
         destination = coalesce(nullif(btrim(coalesce(p_destination, '')), ''), destination),
         active = coalesce(p_active, active),
         updated_at = now()
   where id = p_tag_id
  returning * into v_tag;
  return v_tag;
end;
$$;

-- Toques por cartel: este mes, el mes anterior (en la zona horaria del negocio) y total.
create function reputation.tag_stats(p_business_id uuid)
returns table (tag_id uuid, taps_this_month bigint, taps_last_month bigint, taps_total bigint,
               last_tap_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_month_start timestamptz;
  v_prev_start timestamptz;
begin
  perform core.require_member(p_business_id);
  if not core.has_module(p_business_id, 'reputation') then
    perform core.raise_forbidden('module_disabled');
  end if;
  select timezone into v_tz from core.businesses where id = p_business_id;
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_prev_start := (date_trunc('month', now() at time zone v_tz) - interval '1 month') at time zone v_tz;

  return query
    select t.id,
           count(tp.id) filter (where tp.tapped_at >= v_month_start),
           count(tp.id) filter (where tp.tapped_at >= v_prev_start and tp.tapped_at < v_month_start),
           count(tp.id),
           max(tp.tapped_at)
      from reputation.tags t
      left join reputation.taps tp on tp.business_id = t.business_id and tp.tag_id = t.id
     where t.business_id = p_business_id
     group by t.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Para la Edge Function `tap` (solo service_role): registra el toque y devuelve
-- a dónde redirigir. null = código desconocido o cartel apagado.
-- -----------------------------------------------------------------------------
create function reputation.resolve_tap(p_code text, p_source text default 'nfc') returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag reputation.tags;
begin
  select * into v_tag from reputation.tags where code = lower(coalesce(p_code, '')) and active;
  if not found or not core.has_module(v_tag.business_id, 'reputation') then
    return null;
  end if;
  insert into reputation.taps (business_id, tag_id, source)
  values (v_tag.business_id, v_tag.id,
          case when p_source in ('nfc', 'qr', 'link') then p_source else 'link' end);
  return v_tag.destination;
end;
$$;

revoke execute on all functions in schema reputation from public, anon, authenticated;
grant execute on function
  reputation.create_tag(uuid, text, text),
  reputation.update_tag(uuid, text, text, boolean),
  reputation.tag_stats(uuid)
to authenticated;
grant execute on function reputation.resolve_tap(text, text) to service_role;
revoke execute on all functions in schema core from public, anon;
