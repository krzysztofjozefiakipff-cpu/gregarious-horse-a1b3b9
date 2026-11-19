#!/usr/bin/env bash
set -euo pipefail
release="$1"
if [ ! -t 0 ]; then IFS= read -r GIPHY_API_KEY || true; fi
export GIPHY_API_KEY
[[ "$release" =~ ^[0-9a-f]{40}$ ]]
test "$(id -un)" = carvamo-deploy
proxy=carvamo-preview-web
service=carvamo-lejek
directory="$HOME/carvamo-lejek"
archive="$directory/$release.tgz"
stage=$(mktemp -d "$directory/build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
test "$(docker inspect -f '{{ index .Config.Labels "com.carvamo.role" }}' "$proxy")" = preview
docker network inspect carvamo_backend_private >/dev/null
docker exec carvamo-accounts-staging python -c 'from urllib.request import urlopen; assert urlopen("http://127.0.0.1:8000/api/health",timeout=5).status==200'
tar -xzf "$archive" --no-same-owner --no-same-permissions -C "$stage"
image="$service:$release"
docker build -t "$image" "$stage"
production_volume=biegwyzej_production_data
initialize_production=0
if ! docker volume inspect "$production_volume" >/dev/null 2>&1; then
  initialize_production=1
fi
docker volume create "$production_volume" >/dev/null
old_image=
old_volume=
if docker container inspect "$service" >/dev/null 2>&1; then
  test "$(docker inspect -f '{{ index .Config.Labels "com.carvamo.role" }}' "$service")" = lejek
  old_volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$service")
  test -n "$old_volume"
  old_image=$(docker inspect -f '{{.Config.Image}}' "$service")
fi
run_service() {
  local deployed_image="$1" data_volume="$2"
  docker run -d --name "$service" --label com.carvamo.role=lejek --restart unless-stopped \
    --network carvamo_backend_private -e "LEJEK_RELEASE=${deployed_image##*:}" -e GIPHY_API_KEY --read-only --tmpfs /tmp:rw,noexec,nosuid \
    --security-opt no-new-privileges --cap-drop ALL -v "$data_volume:/data" "$deployed_image" >/dev/null
}
if [ -n "$old_image" ]; then docker rm -f "$service" >/dev/null; fi
rollback() {
  docker rm -f "$service" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then run_service "$old_image" "$old_volume"; fi
}
if ! run_service "$image" "$production_volume"; then rollback; exit 1; fi
for attempt in {1..12}; do
  if docker exec "$service" node -e 'fetch("http://localhost:8075/healthz").then(async r=>{if(!r.ok||await r.text()!=="lejek-ok")process.exit(1)}).catch(()=>process.exit(1))'; then
    if [ "$initialize_production" = 1 ] && ! docker exec "$service" node --input-type=module -e '
      import { DatabaseSync } from "node:sqlite";
      const db = new DatabaseSync("/data/lejek.sqlite", {readOnly: true});
      for (const table of ["accounts", "dealer_group_heads", "lejek_credentials", "plans", "review_plans", "funnel_plans", "daily_results", "results"]) {
        if (db.prepare("SELECT count(*) AS total FROM " + table).get().total !== 0) process.exit(1);
      }
    '; then
      rollback
      exit 1
    fi
    if [ "$initialize_production" = 1 ]; then echo "Verified empty production users, plans and results."; fi
    echo "Lejek started on OVH: $release"
    exit 0
  fi
  sleep 2
done
rollback
exit 1
