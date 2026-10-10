#!/usr/bin/env bash
# Simulacro de copia de seguridad (TASKS.md §65). Solo en CI, con un Supabase
# local y datos de prueba (seed): nunca toca el proyecto de desarrollo ni producción.
#
# 1. Hace la copia igual que docs/DEPLOY.md §D7 (roles, estructura y datos).
# 2. Levanta un Supabase vacío (como un proyecto nuevo, sin nuestras migraciones).
# 3. Restaura la copia como dice docs/RESTAURAR.md.
# 4. Compara cuántas filas hay en las tablas importantes antes y después.
set -euo pipefail

# Mueve carpetas del repo y hace `supabase db reset`: solo en CI, nunca en una
# computadora con trabajo sin guardar.
if [[ "${CI:-}" != "true" ]]; then
  echo "backup-drill.sh solo corre en CI (CI=true). No lo ejecutes a mano." >&2
  exit 1
fi

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OUT="$(mktemp -d)"

# Si algo falla mientras las migraciones o el seed están afuera, se devuelven.
restore_repo() {
  if [[ -d "$OUT/migrations" && ! -e supabase/migrations ]]; then
    mv "$OUT/migrations" supabase/migrations
  fi
  if [[ -f "$OUT/seed.sql" && ! -e supabase/seed.sql ]]; then
    mv "$OUT/seed.sql" supabase/seed.sql
  fi
}
trap restore_repo EXIT

counts() {
  psql "$DB_URL" -At -v ON_ERROR_STOP=1 -c "
    select 'core.businesses', count(*) from core.businesses
    union all select 'core.customers', count(*) from core.customers
    union all select 'core.visits', count(*) from core.visits
    union all select 'core.customer_stats', count(*) from core.customer_stats
    union all select 'core.memberships', count(*) from core.memberships
    union all select 'loyalty.members', count(*) from loyalty.members
    union all select 'loyalty.ledger', count(*) from loyalty.ledger
    union all select 'auth.users', count(*) from auth.users
    order by 1"
}

echo "== Datos de prueba antes de la copia"
supabase db reset --local
counts | tee "$OUT/before.txt"
if ! grep -qE '^core.customers\|[1-9]' "$OUT/before.txt"; then
  echo "::error title=backup drill::El seed no cargó clientes: el simulacro no probaría nada."
  exit 1
fi

echo "== Copia (igual que docs/DEPLOY.md §D7)"
supabase db dump --local -f "$OUT/roles.sql" --role-only
supabase db dump --local -f "$OUT/schema.sql"
supabase db dump --local -f "$OUT/data.sql" --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"

echo "== Supabase vacío (como un proyecto nuevo)"
supabase stop --no-backup
mv supabase/migrations "$OUT/migrations"
mv supabase/seed.sql "$OUT/seed.sql"
supabase db start
restore_repo

echo "== Restauración (docs/RESTAURAR.md)"
# roles.sql no se restaura: el proyecto no crea roles propios y el nuevo ya trae
# los de Supabase (intentar cambiarlos da "permission denied").
psql "$DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -f "$OUT/schema.sql" \
  -c 'set session_replication_role = replica' \
  -f "$OUT/data.sql"

echo "== Datos después de restaurar"
counts | tee "$OUT/after.txt"

if diff -u "$OUT/before.txt" "$OUT/after.txt"; then
  echo "Simulacro OK: la copia se restauró completa."
else
  echo "::error title=backup drill::La restauración no recuperó los mismos datos (ver diff)."
  exit 1
fi
