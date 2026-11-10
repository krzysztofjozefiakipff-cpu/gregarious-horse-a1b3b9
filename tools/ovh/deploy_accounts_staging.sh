#!/usr/bin/env bash
set -euo pipefail
[ "$(id -un)" = "carvamo-deploy" ] || exit 2
BASE="$HOME/carvamo-backend"
install -d -m 700 "$BASE"
if [ ! -s "$BASE/accounts-db-password" ]; then
  umask 077
  openssl rand -hex 32 > "$BASE/accounts-db-password"
fi
if [ ! -s "$BASE/accounts-session-secret" ]; then
  umask 077
  openssl rand -hex 48 > "$BASE/accounts-session-secret"
fi
PASS="$(cat "$BASE/accounts-db-password")"
# The DB password is sent over the local docker exec stdin, not included in process arguments.
docker exec -i carvamo-db-staging psql -v ON_ERROR_STOP=1 -U carvamo -d carvamo -v app_pass="$PASS" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'carvamo_accounts', :'app_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='carvamo_accounts') \gexec
ALTER ROLE carvamo_accounts NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE carvamo_accounts SET search_path = public;
GRANT CONNECT ON DATABASE carvamo TO carvamo_accounts;
GRANT USAGE ON SCHEMA public TO carvamo_accounts;
GRANT SELECT ON users, dealers TO carvamo_accounts;
GRANT INSERT, UPDATE ON users TO carvamo_accounts;
GRANT SELECT, INSERT ON account_audit TO carvamo_accounts;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO carvamo_accounts;
GRANT EXECUTE ON FUNCTION carvamo_can_manage_account(uuid,text,uuid) TO carvamo_accounts;
GRANT EXECUTE ON FUNCTION carvamo_can_access_dealer(uuid,uuid) TO carvamo_accounts;
SQL
umask 077
cat > "$BASE/accounts.env" <<EOF
DATABASE_URL=postgresql://carvamo_accounts:$PASS@carvamo-db-staging:5432/carvamo
SESSION_SECRET=$(cat "$BASE/accounts-session-secret")
EOF
if [ -s "$BASE/accounts-mail.env" ]; then
  printf '\n' >> "$BASE/accounts.env"
  cat "$BASE/accounts-mail.env" >> "$BASE/accounts.env"
fi
chmod 600 "$BASE/accounts.env"
docker build -t carvamo-accounts:staging "$BASE/accounts-src"
if docker inspect carvamo-accounts-staging >/dev/null 2>&1; then
  docker rm -f carvamo-accounts-staging >/dev/null
fi
docker run -d --name carvamo-accounts-staging --label com.carvamo.role=accounts-staging --restart unless-stopped --network carvamo_backend_private --env-file "$BASE/accounts.env" --read-only --tmpfs /tmp:rw,noexec,nosuid --security-opt no-new-privileges --cap-drop ALL carvamo-accounts:staging >/dev/null
for i in $(seq 1 20); do
  if docker exec carvamo-accounts-staging python -c 'import urllib.request; assert urllib.request.urlopen("http://127.0.0.1:8000/api/health",timeout=2).status==200' >/dev/null 2>&1; then
    echo "CARVAMO ACCOUNTS PRIVATE STAGING HEALTHY (no public ports)"
    exit 0
  fi
  sleep 2
done
docker logs --tail 25 carvamo-accounts-staging >&2
exit 4
