#!/usr/bin/env bash
# Corre un comando en CI y, si falla, publica las últimas líneas como anotación
# de GitHub (legibles desde la API de checks). Uso: scripts/ci-run.sh "titulo" cmd args...
set -uo pipefail
title="$1"; shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  msg="$(grep -vE '^\s*$' "$log" | tail -60 | sed ':a;N;$!ba;s/%/%25/g;s/\r/%0D/g;s/\n/%0A/g')"
  echo "::error title=${title}::${msg}"
fi
exit "$status"
