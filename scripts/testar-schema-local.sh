#!/usr/bin/env bash
# Executa supabase/setup-completo.sql num Postgres local e exercita as regras de
# segurança sem tocar no banco de produção. Requer Docker.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER=maintenex-database-1

cd "$RAIZ"
docker compose up -d database >/dev/null
until docker exec "$CONTAINER" pg_isready -U maintenex -d maintenex >/dev/null 2>&1; do sleep 2; done

for arquivo in supabase/testes/auth-stub.sql supabase/setup-completo.sql supabase/testes/rls.sql; do
  docker cp "$arquivo" "$CONTAINER:/tmp/$(basename "$arquivo")" >/dev/null
done

echo "== aplicando stub do schema auth =="
docker exec "$CONTAINER" psql -U maintenex -d maintenex -q -f /tmp/auth-stub.sql >/dev/null 2>&1

echo "== aplicando setup-completo.sql =="
docker exec "$CONTAINER" psql -U maintenex -d maintenex -q -v ON_ERROR_STOP=1 -f /tmp/setup-completo.sql 2>&1 \
  | grep -E "NOTICE:  (Maintenex|tabelas|policies|triggers|empresas)" || true

echo
echo "== regras de acesso =="
docker exec "$CONTAINER" psql -U maintenex -d maintenex -f /tmp/rls.sql 2>&1 \
  | grep -vE "^(INSERT 0|GRANT|SET|RESET|CREATE|UPDATE)" | grep -vE "^\s*$"
