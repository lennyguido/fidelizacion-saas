-- =============================================================================
-- CORE · Catálogo de módulos, planes, suscripciones y módulos habilitados.
-- Ver docs/ARCHITECTURE.md §10.
-- =============================================================================

create table core.modules (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null,
  description text,
  available   boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table core.modules is 'Catálogo global de módulos (productos) de la plataforma.';

create table core.plans (
  id         text primary key check (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table core.plan_modules (
  plan_id   text not null references core.plans (id) on delete cascade,
  module_id text not null references core.modules (id) on delete restrict,
  limits    jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  primary key (plan_id, module_id)
);

create table core.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references core.businesses (id) on delete restrict,
  plan_id            text not null references core.plans (id),
  status             text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  provider           text,
  provider_ref       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, id)
);

create index subscriptions_business_idx on core.subscriptions (business_id);
-- Como máximo una suscripción vigente por negocio.
create unique index subscriptions_one_current_idx on core.subscriptions (business_id)
  where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_updated_at before update on core.subscriptions
  for each row execute function core.set_updated_at();

-- Fuente de verdad del acceso a cada módulo (la suscripción la mantiene).
create table core.business_modules (
  business_id uuid not null references core.businesses (id) on delete restrict,
  module_id   text not null references core.modules (id) on delete restrict,
  enabled     boolean not null default true,
  limits      jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (business_id, module_id),
  check (ends_at is null or ends_at > starts_at)
);

create trigger business_modules_updated_at before update on core.business_modules
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers de módulos
-- -----------------------------------------------------------------------------

create function core.my_business_ids_with_module(p_module text) returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select bm.business_id
  from core.business_modules bm
  where bm.module_id = p_module
    and bm.enabled
    and bm.starts_at <= now()
    and (bm.ends_at is null or bm.ends_at > now())
    and bm.business_id in (select core.my_business_ids())
$$;

create function core.has_module(p_business_id uuid, p_module text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from core.business_modules bm
    where bm.business_id = p_business_id
      and bm.module_id = p_module
      and bm.enabled
      and bm.starts_at <= now()
      and (bm.ends_at is null or bm.ends_at > now())
  )
$$;

grant execute on function
  core.my_business_ids_with_module(text),
  core.has_module(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table core.modules enable row level security;
alter table core.plans enable row level security;
alter table core.plan_modules enable row level security;
alter table core.subscriptions enable row level security;
alter table core.business_modules enable row level security;

grant select on core.modules, core.plans, core.plan_modules,
                core.subscriptions, core.business_modules to authenticated;

-- Catálogos: visibles para cualquier usuario autenticado.
create policy modules_select on core.modules for select to authenticated using (true);
create policy plans_select on core.plans for select to authenticated using (active);
create policy plan_modules_select on core.plan_modules for select to authenticated using (true);

-- Suscripción: solo owner/admin. Sin escrituras desde el cliente.
create policy subscriptions_select on core.subscriptions
  for select to authenticated
  using (business_id in (select core.my_business_ids_with_role(array['owner', 'admin'])));

-- Módulos habilitados: todos los miembros (el menú depende de esto).
create policy business_modules_select on core.business_modules
  for select to authenticated
  using (business_id in (select core.my_business_ids()));

-- -----------------------------------------------------------------------------
-- Datos de referencia
-- -----------------------------------------------------------------------------

insert into core.modules (id, name, description, available) values
  ('loyalty',    'Fidelización',      'Puntos, sellos, recompensas y canjes.',                 true),
  ('recovery',   'Recuperación',      'Clientes en riesgo, campañas y dinero recuperado.',     true),
  ('booking',    'Turnos',            'Agenda, disponibilidad y huecos libres.',               false),
  ('reputation', 'Reputación',        'Pedidos de reseña y reputación en Google.',             false),
  ('seller',     'WhatsApp vendedor', 'Atención y ventas por WhatsApp.',                       false);

insert into core.plans (id, name) values ('pilot', 'Piloto');

insert into core.plan_modules (plan_id, module_id) values
  ('pilot', 'loyalty'),
  ('pilot', 'recovery');

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
