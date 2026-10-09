#!/usr/bin/env bash
# Prueba migraciones + seed + tests pgTAP en un Postgres común (sin Supabase).
# Uso: PGHOST=... PGPORT=... PGUSER=postgres scripts/db-test-local.sh
# En CI / Codespaces se usa `supabase test db` (ver README).
set -euo pipefail
shopt -s nullglob
export PGOPTIONS="${PGOPTIONS:-} -c search_path=public,extensions"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${TEST_DB:-plataforma_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

dropdb --if-exists "$DB"
createdb "$DB"

"${PSQL[@]}" -f "$ROOT/scripts/supabase_shim.sql"
"${PSQL[@]}" -c 'create extension if not exists pgtap with schema extensions;'

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "seed: seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"

failed=0
for f in "$ROOT"/supabase/tests/database/*.test.sql; do
  out="$(cd "$(dirname "$f")" && psql -X -q -t -A -v ON_ERROR_STOP=1 -d "$DB" -f "$(basename "$f")" 2>&1)" || true
  if grep -qE '^not ok|ERROR|Looks like' <<<"$out"; then
    echo "FAIL $(basename "$f")"
    grep -E '^not ok|ERROR|#' <<<"$out" | head -40
    failed=1
  else
    echo "ok   $(basename "$f") ($(grep -c '^ok' <<<"$out") assertions)"
  fi
done

exit $failed
