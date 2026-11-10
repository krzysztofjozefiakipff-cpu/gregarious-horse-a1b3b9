#!/usr/bin/env python3
"""Interactive one-time owner bootstrap. Run only on OVH host with an attached TTY.

Example (operator terminal, never GitHub Actions):
  python3 bootstrap_owner.py admin@example.com

No default account, no password in repository or workflow logs.
"""
import getpass
import os
import re
import secrets
import sys
import psycopg
from argon2 import PasswordHasher

def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", sys.argv[1]):
        raise SystemExit("Usage: bootstrap_owner.py verified-admin-email")
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SystemExit("Interactive terminal required; never run in CI")
    email = sys.argv[1].strip().lower()
    print("This will create the first CARVAMO administrator on OVH staging.")
    confirmation = input("Enter the exact verified email to confirm: ").strip().lower()
    if confirmation != email:
        raise SystemExit("Cancelled")
    password = secrets.token_urlsafe(32)
    password_hash = PasswordHasher().hash(password)
    with psycopg.connect(os.environ["DATABASE_URL"]) as db:
        with db.cursor() as cur:
            cur.execute("SELECT count(*) FROM users WHERE role='admin'")
            if cur.fetchone()[0]:
                raise SystemExit("An administrator already exists; bootstrap refused")
            cur.execute("ALTER TABLE users DISABLE TRIGGER users_guard")
            try:
                cur.execute("INSERT INTO users(email,password_hash,role,dealer_id,enabled) VALUES (%s,%s,'admin',NULL,true) RETURNING id", (email, password_hash))
                uid = cur.fetchone()[0]
            finally:
                cur.execute("ALTER TABLE users ENABLE TRIGGER users_guard")
            cur.execute("INSERT INTO account_audit(target_id,action,new_role) VALUES (%s,'create','admin')", (uid,))
    print("Administrator created:", email)
    print("One-time password (copy now; not stored in plaintext):", password)
    print("Change this password immediately after first login.")

if __name__ == "__main__":
    main()
