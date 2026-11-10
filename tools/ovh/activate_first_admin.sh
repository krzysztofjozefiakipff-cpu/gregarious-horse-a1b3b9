#!/usr/bin/env bash
set -euo pipefail
# Interactive owner activation on OVH. No credentials or passwords in GitHub logs.
[ -t 0 ] && [ -t 1 ] || { echo "Run from an interactive SSH terminal"; exit 2; }
[ "$(id -un)" = "carvamo-deploy" ] || { echo "Wrong SSH user"; exit 2; }
EMAIL="admin@carvamo.com"
echo "CARVAMO staging: first administrator activation for $EMAIL"
read -r -p "Type admin@carvamo.com to confirm: " CONFIRM
[ "$CONFIRM" = "$EMAIL" ] || { echo "Cancelled"; exit 3; }
# Generate the secret inside the isolated accounts Python container, where argon2 is installed.
# Never pass plaintext password to shell arguments or environment.
TEMP="$(mktemp)"
trap 'rm -f "$TEMP"' EXIT
chmod 600 "$TEMP"
docker exec carvamo-accounts-staging python -c '
import secrets
from argon2 import PasswordHasher
password=secrets.token_urlsafe(32)
print(PasswordHasher().hash(password))
print(password)
' > "$TEMP"
HASH="$(head -n 1 "$TEMP")"
# The SQL transaction is sent on stdin, and only the password hash enters the database.
# Protect against duplicate bootstrap and keep trigger enabled except during the insertion.
docker exec -i carvamo-db-staging psql -X -v ON_ERROR_STOP=1 -U carvamo -d carvamo -v owner_email="$EMAIL" -v owner_hash="$HASH" <<'SQL'
BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM users WHERE role='admin') THEN
  RAISE EXCEPTION 'Administrator already exists: bootstrap refused';
 END IF;
END $$;
ALTER TABLE users DISABLE TRIGGER users_guard;
INSERT INTO users(email,password_hash,role,dealer_id,enabled)
VALUES (:'owner_email', :'owner_hash', 'admin', NULL, true);
ALTER TABLE users ENABLE TRIGGER users_guard;
INSERT INTO account_audit(target_id,action,new_role)
SELECT id,'create','admin' FROM users WHERE lower(email)=lower(:'owner_email');
COMMIT;
SQL
echo
echo "CARVAMO admin account created: $EMAIL"
echo "ONE-TIME PASSWORD (save privately; do not paste into chat):"
tail -n 1 "$TEMP"
echo "Log in at https://preview.carvamo.com/accounts/"
echo "Change the temporary password immediately after first login."
