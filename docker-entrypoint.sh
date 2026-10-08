#!/bin/sh
set -e

if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "ERROR: falta SESSION_SECRET (mínimo 32 caracteres). Configúralo en las variables de entorno." >&2
  exit 1
fi

# Aplica migraciones pendientes sobre la base del volumen (crea app.db la primera vez)
npx prisma migrate deploy

# Panel + worker. -k: si uno muere se apaga todo y Docker/Dokploy reinicia el contenedor
exec npx concurrently -k -n web,worker "npx next start" "npx tsx worker/index.mts"
