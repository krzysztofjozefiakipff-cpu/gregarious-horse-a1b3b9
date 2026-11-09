#!/usr/bin/env bash
set -euo pipefail
SHA="$1"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "BLOCKED: invalid commit SHA"; exit 2; }
[ "$(id -un)" = "carvamo-deploy" ] || { echo "BLOCKED: wrong user"; exit 2; }
BASE="$HOME/carvamo-preview"
NAME="carvamo-preview-web"
UPLOAD="$BASE/upload-$SHA.tgz"
CONFIG_UPLOAD="$BASE/config-$SHA.Caddyfile"
RELEASE="$BASE/releases/$SHA"
if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  echo "BLOCKED: deploy user has no Docker access. No host changes made."
  exit 5
fi
test -s "$UPLOAD" && test -s "$CONFIG_UPLOAD" || { echo "BLOCKED: missing uploaded files"; exit 6; }
if docker container inspect "$NAME" >/dev/null 2>&1; then
  LABEL="$(docker inspect --format '{{ index .Config.Labels "com.carvamo.role" }}' "$NAME")"
  [ "$LABEL" = "preview" ] || { echo "BLOCKED: container name conflict"; exit 7; }
else
  if [ -n "$(ss -H -ltn '( sport = :80 or sport = :443 )')" ]; then
    echo "BLOCKED: port 80 or 443 occupied"; exit 8
  fi
fi
mkdir -p "$BASE/releases"
if [ ! -d "$RELEASE" ]; then
  mkdir "$RELEASE.tmp"
  tar -xzf "$UPLOAD" -C "$RELEASE.tmp" --no-same-owner --no-same-permissions
  test -s "$RELEASE.tmp/index.html" || { echo "BLOCKED: missing index.html"; exit 9; }
  mv "$RELEASE.tmp" "$RELEASE"
fi
if [ ! -e "$BASE/Caddyfile" ]; then
  cp "$CONFIG_UPLOAD" "$BASE/Caddyfile"
elif ! cmp -s "$CONFIG_UPLOAD" "$BASE/Caddyfile"; then
  echo "BLOCKED: unexpected server configuration change"; exit 10
fi
PREVIOUS=""
if [ -L "$BASE/current" ]; then PREVIOUS="$(readlink "$BASE/current")"; fi
ln -s "releases/$SHA" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
CREATED=0
rollback() {
  if [ -n "$PREVIOUS" ]; then
    ln -s "$PREVIOUS" "$BASE/current.rollback"
    mv -Tf "$BASE/current.rollback" "$BASE/current"
  else
    rm -f "$BASE/current"
    if [ "$CREATED" = 1 ]; then docker rm -f "$NAME" >/dev/null 2>&1 || true; fi
  fi
}
if ! docker container inspect "$NAME" >/dev/null 2>&1; then
  if ! docker run -d --name "$NAME" --label com.carvamo.role=preview --restart unless-stopped -p 80:80 -p 443:443 -v "$BASE:/site:ro" -v "$BASE/Caddyfile:/etc/caddy/Caddyfile:ro" -v carvamo_preview_caddy_data:/data -v carvamo_preview_caddy_config:/config caddy:2 >/dev/null; then
    rollback; echo "BLOCKED: Docker launch failed"; exit 11
  fi
  CREATED=1
fi
if ! docker ps --filter "name=^/$NAME$" --filter "status=running" --format '{{.Names}}' | grep -qx "$NAME"; then
  rollback; echo "BLOCKED: preview container not running"; exit 12
fi
OK=0
for i in $(seq 1 18); do
  if curl -fsS --max-time 10 --resolve "preview.carvamo.com:443:127.0.0.1" "https://preview.carvamo.com/" 2>/dev/null | grep -q 'ŚRODOWISKO TESTOWE CARVAMO'; then
    OK=1; break
  fi
  sleep 5
done
if [ "$OK" != 1 ]; then
  rollback; echo "BLOCKED: preview HTTPS health check failed"; exit 13
fi
rm -f "$UPLOAD" "$CONFIG_UPLOAD"
echo "PREVIEW DEPLOYED: $SHA"
echo "https://preview.carvamo.com"
