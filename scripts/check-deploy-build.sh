#!/usr/bin/env bash
# Revisa que el build de producción de las dos apps quedó listo para Cloudflare Pages
# (docs/DEPLOY.md). Se corre después de `npm run build`, con las mismas variables VITE_*
# en el entorno que se cargan en Cloudflare (en CI son valores públicos de mentira).
#
#   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... VITE_CLIENT_APP_URL=... \
#     npm run build && scripts/check-deploy-build.sh
set -euo pipefail

errors=0
fail() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
}

for var in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_CLIENT_APP_URL; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: falta la variable $var (la misma que se carga en Cloudflare Pages)" >&2
    exit 1
  fi
done

for app in admin client; do
  dist="apps/$app/dist"
  headers="$dist/_headers"

  [ -f "$dist/index.html" ] || { fail "$dist/index.html no existe: ¿corrió el build?"; continue; }

  # Sin 404.html, Cloudflare Pages sirve index.html en cualquier ruta (modo SPA).
  [ ! -e "$dist/404.html" ] || fail "$dist/404.html existe: Cloudflare dejaría de servir index.html en rutas como /tarjeta"

  # La CSP solo permite scripts y estilos de archivos propios: nada en línea en index.html.
  if grep -Pq '<script(?![^>]*\ssrc=)[^>]*>' "$dist/index.html"; then
    fail "$dist/index.html tiene un <script> en línea (lo bloquearía la CSP)"
  fi
  if grep -Eq '<style|[[:space:]]style=' "$dist/index.html"; then
    fail "$dist/index.html tiene estilos en línea (los bloquearía la CSP)"
  fi

  # Las variables se tomaron del entorno (en Cloudflare no hay .env.local).
  if ! grep -rqF "$VITE_SUPABASE_URL" "$dist/assets"; then
    fail "$app: VITE_SUPABASE_URL no quedó en el build (¿Vite no leyó las variables del entorno?)"
  fi

  if [ ! -f "$headers" ]; then
    fail "$headers no existe (tiene que estar en apps/$app/public/_headers)"
    continue
  fi
  rules="$(grep -v '^[[:space:]]*#' "$headers")"
  for required in 'Content-Security-Policy:' 'X-Content-Type-Options: nosniff' \
    "connect-src 'self' https://*.supabase.co" "frame-ancestors 'none'"; do
    grep -qF -- "$required" <<<"$rules" || fail "$headers no tiene: $required"
  done
  # Cloudflare une con coma los encabezados repetidos y no acepta líneas de más de 2000 caracteres.
  duplicated="$(grep -E '^[[:space:]]+[A-Za-z-]+:' <<<"$rules" | sed -E 's/^[[:space:]]+([A-Za-z-]+):.*/\1/' | sort | uniq -d)"
  [ -z "$duplicated" ] || fail "$headers repite encabezados: $duplicated"
  if awk 'length > 2000 { found = 1 } END { exit !found }' "$headers"; then
    fail "$headers tiene una línea de más de 2000 caracteres (límite de Cloudflare)"
  fi
done

grep -q 'X-Frame-Options: DENY' apps/admin/dist/_headers 2>/dev/null ||
  fail "el panel tiene que mandar X-Frame-Options: DENY"
grep -q 'Referrer-Policy: no-referrer' apps/client/dist/_headers 2>/dev/null ||
  fail "la tarjeta tiene que mandar Referrer-Policy: no-referrer"

if ! grep -rqF "$VITE_CLIENT_APP_URL" apps/admin/dist/assets 2>/dev/null; then
  fail "admin: VITE_CLIENT_APP_URL no quedó en el build (los links de la tarjeta apuntarían a :5174)"
fi

manifest="apps/client/dist/manifest.webmanifest"
if [ -f "$manifest" ]; then
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$manifest" ||
    fail "$manifest no es JSON válido"
  grep -q 'rel="manifest" href="/manifest.webmanifest"' apps/client/dist/index.html ||
    fail "apps/client/dist/index.html no enlaza el manifest"
else
  fail "$manifest no existe (la tarjeta no se podría instalar en el teléfono)"
fi

if [ "$errors" -gt 0 ]; then
  echo "$errors problema(s) en el build para Cloudflare Pages" >&2
  exit 1
fi
echo "OK: admin y client listos para Cloudflare Pages"
