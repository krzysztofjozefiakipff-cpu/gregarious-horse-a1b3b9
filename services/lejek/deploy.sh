#!/usr/bin/env bash
set -euo pipefail
release="$1"
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
docker volume create carvamo_lejek_data >/dev/null
old_image=
if docker container inspect "$service" >/dev/null 2>&1; then
  test "$(docker inspect -f '{{ index .Config.Labels "com.carvamo.role" }}' "$service")" = lejek
  old_image=$(docker inspect -f '{{.Config.Image}}' "$service")
fi
run_service() {
  docker run -d --name "$service" --label com.carvamo.role=lejek --restart unless-stopped \
    --network carvamo_backend_private --read-only --tmpfs /tmp:rw,noexec,nosuid \
    --security-opt no-new-privileges --cap-drop ALL -v carvamo_lejek_data:/data "$1" >/dev/null
}
if [ -n "$old_image" ]; then docker rm -f "$service" >/dev/null; fi
rollback() {
  docker rm -f "$service" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then run_service "$old_image"; fi
}
if ! run_service "$image"; then rollback; exit 1; fi
for attempt in {1..12}; do
  if docker exec "$service" node -e 'fetch("http://localhost:8075/healthz").then(async r=>{if(!r.ok||await r.text()!=="lejek-ok")process.exit(1)}).catch(()=>process.exit(1))'; then
    echo "Lejek started on OVH: $release"
    exit 0
  fi
  sleep 2
done
rollback
exit 1
