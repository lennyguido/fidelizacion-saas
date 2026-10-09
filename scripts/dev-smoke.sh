#!/usr/bin/env bash
# Revisión de SOLO LECTURA del proyecto de desarrollo de Supabase.
# No crea, modifica ni borra nada. Usa la publishable key (es pública: va en el navegador).
set -uo pipefail
URL="${DEV_SUPABASE_URL:?}"
KEY="${DEV_SUPABASE_PUBLISHABLE_KEY:?}"
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

echo "== 1. Configuración de Auth (pública) =="
curl -s "${H[@]}" "$URL/auth/v1/settings" | python3 -c '
import json,sys; s=json.load(sys.stdin)
print("Registro por email habilitado:", s.get("external",{}).get("email"))
print("Registro de usuarios deshabilitado:", s.get("disable_signup"))
print("Confirmación de email ACTIVADA:", not s.get("mailer_autoconfirm"))'

echo; echo "== 2. ¿El esquema core está expuesto en la Data API? =="
out=$(curl -s -w '\nHTTP %{http_code}' "${H[@]}" -H "Accept-Profile: core" "$URL/rest/v1/plans?select=code&limit=1")
echo "$out"

echo; echo "== 3. Sin iniciar sesión NO se pueden leer clientes (esperado: error o lista vacía) =="
curl -s -w '\nHTTP %{http_code}\n' "${H[@]}" -H "Accept-Profile: core" "$URL/rest/v1/customers?select=id&limit=1"

echo; echo "== 4. Sin iniciar sesión NO se pueden llamar funciones (esperado: permiso denegado) =="
curl -s -w '\nHTTP %{http_code}\n' "${H[@]}" -H "Content-Profile: core" -H "Content-Type: application/json" \
  -d '{"p_slug":"prueba"}' "$URL/rest/v1/rpc/is_slug_available"

echo; echo "== 5. ¿El esquema loyalty está expuesto? (tarjeta con código inválido: esperado null / HTTP 200) =="
curl -s -w '\nHTTP %{http_code}\n' "${H[@]}" -H "Content-Profile: loyalty" -H "Content-Type: application/json" \
  -d '{"p_token":"0000000000000000000000000000000000000000000000000000000000000000"}' "$URL/rest/v1/rpc/get_card"

echo; echo "== 6. Sin sesión NO se pueden leer socios ni el libro de puntos =="
curl -s -w '\nHTTP %{http_code}\n' "${H[@]}" -H "Accept-Profile: loyalty" "$URL/rest/v1/members?select=id&limit=1"
curl -s -w '\nHTTP %{http_code}\n' "${H[@]}" -H "Accept-Profile: loyalty" "$URL/rest/v1/cards?select=token_hash&limit=1"
