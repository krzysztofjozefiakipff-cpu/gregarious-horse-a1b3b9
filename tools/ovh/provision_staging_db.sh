#!/usr/bin/env bash
set -euo pipefail
[ "$(id -un)" = "carvamo-deploy" ] || { echo "BLOCKED: wrong user"; exit 2; }
command -v docker >/dev/null && docker info >/dev/null 2>&1 || { echo "BLOCKED: Docker unavailable"; exit 3; }
BASE="$HOME/carvamo-backend"
NAME="carvamo-db-staging"
mkdir -p "$BASE"
chmod 700 "$BASE"
if [ ! -s "$BASE/postgres-password" ]; then
  umask 077
  openssl rand -hex 32 > "$BASE/postgres-password"
fi
PASS="$(cat "$BASE/postgres-password")"
if docker container inspect "$NAME" >/dev/null 2>&1; then
  LABEL="$(docker inspect --format '{{ index .Config.Labels "com.carvamo.role" }}' "$NAME")"
  [ "$LABEL" = "database-staging" ] || { echo "BLOCKED: container conflict"; exit 4; }
  docker start "$NAME" >/dev/null || true
else
  docker volume create carvamo_postgres_staging >/dev/null
  docker network inspect carvamo_backend_private >/dev/null 2>&1 || docker network create --internal carvamo_backend_private >/dev/null
  docker run -d --name "$NAME" --label com.carvamo.role=database-staging --restart unless-stopped --network carvamo_backend_private --mount source=carvamo_postgres_staging,target=/var/lib/postgresql/data -e POSTGRES_USER=carvamo -e POSTGRES_DB=carvamo -e POSTGRES_PASSWORD="$PASS" postgres:16-alpine >/dev/null
fi
for i in $(seq 1 25); do
  if docker exec "$NAME" pg_isready -U carvamo -d carvamo >/dev/null 2>&1; then
    echo "CARVAMO OVH STAGING POSTGRES READY (private Docker network, no published ports)"
    docker exec "$NAME" psql -U carvamo -d carvamo -Atqc 'select current_database();'
    exit 0
  fi
  sleep 2
done
echo "BLOCKED: database did not become ready"; exit 5
