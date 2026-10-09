-- =============================================================================
-- CORE · Clientes del negocio, consentimientos y cuentas de cliente final.
-- La identidad del cliente es independiente del programa de puntos (D-007).
-- Ver docs/ARCHITECTURE.md §4.
-- =============================================================================

create table core.customers (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references core.businesses (id) on delete restrict,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  phone         text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email         text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and email = lower(email)),
  birthdate     date check (birthdate > date '1900-01-01'),
  notes         text check (char_length(notes) <= 2000),
  tags          text[] not null default '{}',
  source        text not null default 'manual'
                check (source in ('manual', 'import', 'qr', 'booking', 'integration')),
  status        text not null default 'active' check (status in ('active', 'archived')),
  anonymized_at timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, id)
);

comment on column core.customers.phone is 'Formato E.164, ej. +5491122334455';

create index customers_business_idx on core.customers (business_id, created_at desc);
create unique index customers_business_phone_idx on core.customers (business_id, phone)
  where phone is not null;
create unique index customers_business_email_idx on core.customers (business_id, email)
  where email is not null;

create trigger customers_updated_at before update on core.customers
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Consentimientos (Ley 25.326). Historial append-only; vale el último registro.
-- -----------------------------------------------------------------------------

create table core.customer_consents (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  customer_id uuid not null,
  channel     text not null check (channel in ('whatsapp', 'email', 'sms')),
  purpose     text not null check (purpose in ('marketing', 'transactional')),
  granted     boolean not null,
  source      text not null check (source in ('counter', 'customer_app', 'import', 'reply_opt_out', 'admin')),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete restrict
);

create index customer_consents_lookup_idx
  on core.customer_consents (business_id, customer_id, channel, purpose, recorded_at desc);

create view core.customer_consent_status
with (security_invoker = true) as
select distinct on (business_id, customer_id, channel, purpose)
  business_id, customer_id, channel, purpose, granted, recorded_at
from core.customer_consents
order by business_id, customer_id, channel, purpose, recorded_at desc;

-- -----------------------------------------------------------------------------
-- Cuentas de cliente final: vincula un usuario de Auth con su ficha en cada negocio.
-- -----------------------------------------------------------------------------

create table core.customer_accounts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses (id) on delete restrict,
  customer_id uuid not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (business_id, customer_id),
  unique (business_id, user_id),
  foreign key (business_id, customer_id) references core.customers (business_id, id) on delete cascade
);

create index customer_accounts_user_idx on core.customer_accounts (user_id);

create function core.my_customer_ids() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select customer_id from core.customer_accounts where user_id = (select auth.uid())
$$;

grant execute on function core.my_customer_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table core.customers enable row level security;
alter table core.customer_consents enable row level security;
alter table core.customer_accounts enable row level security;

grant select on core.customers, core.customer_consents, core.customer_consent_status,
                core.customer_accounts to authenticated;
grant insert (business_id, name, phone, email, birthdate, notes, tags, source)
  on core.customers to authenticated;
grant update (name, phone, email, birthdate, notes, tags, status)
  on core.customers to authenticated;
grant insert (business_id, customer_id, channel, purpose, granted, source)
  on core.customer_consents to authenticated;

-- Clientes: todo el equipo del negocio los ve, crea y edita. No se borran:
-- se archivan (status) o se anonimizan con una función.
create policy customers_select on core.customers
  for select to authenticated
  using (
    business_id in (select core.my_business_ids())
    or id in (select core.my_customer_ids())
  );

create policy customers_insert on core.customers
  for insert to authenticated
  with check (business_id in (select core.my_business_ids()));

create policy customers_update on core.customers
  for update to authenticated
  using (business_id in (select core.my_business_ids()) and anonymized_at is null)
  with check (business_id in (select core.my_business_ids()));

create function core.set_customer_created_by() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  return new;
end;
$$;

create trigger customers_created_by before insert on core.customers
  for each row when (new.created_by is null)
  execute function core.set_customer_created_by();

-- Consentimientos: el equipo registra; nadie edita ni borra (historial).
create policy customer_consents_select on core.customer_consents
  for select to authenticated
  using (
    business_id in (select core.my_business_ids())
    or customer_id in (select core.my_customer_ids())
  );

create policy customer_consents_insert on core.customer_consents
  for insert to authenticated
  with check (business_id in (select core.my_business_ids()));

create function core.set_consent_recorded_by() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Los clientes de la API no pueden enviar estas columnas (no tienen grant);
  -- se completan acá. Procesos internos (import) pueden mandar su propia fecha.
  new.recorded_by := coalesce(new.recorded_by, (select auth.uid()));
  return new;
end;
$$;

create trigger customer_consents_recorded_by before insert on core.customer_consents
  for each row execute function core.set_consent_recorded_by();

-- Cuentas de cliente: el equipo y el propio cliente las ven. Se crean por función.
create policy customer_accounts_select on core.customer_accounts
  for select to authenticated
  using (
    business_id in (select core.my_business_ids())
    or user_id = (select auth.uid())
  );

-- Postgres da EXECUTE a PUBLIC en toda función nueva: se revoca siempre al final
-- de cada migración. Lo verifica supabase/tests/database/001-security-meta.test.sql.
revoke execute on all functions in schema core from public, anon;
