#!/usr/bin/env python3
"""Read-only preflight for moving CARVAMO photo jobs to OVH PostgreSQL.

Uses CARVAMO_OVH_DATABASE_URL. Never executes DDL or exposes connection details.
The legacy job RPCs must exist on the target before the worker can switch.
"""
import os
import sys

REQUIRED_FUNCTIONS = {
    "cv_ai_claim": 1,
    "cv_ai_complete_v3": 7,
    "cv_ai_fail": 3,
}
REQUIRED_COLUMNS = {
    "id", "state", "worker_run_id", "progress_stage",
    "progress_percent", "progress_at",
}


def check(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name='cv_photo_jobs'
        """)
        columns = {row[0] for row in cur.fetchall()}
        missing = sorted(REQUIRED_COLUMNS - columns)
        if missing:
            print("FAIL: missing photo job columns: " + ",".join(missing))
            return False

        cur.execute("""
            SELECT p.proname, p.pronargs
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname = ANY(%s)
        """, (list(REQUIRED_FUNCTIONS),))
        available = {(name, count) for name, count in cur.fetchall()}
        missing_rpcs = [f"{name}/{arity}" for name, arity in REQUIRED_FUNCTIONS.items()
                        if (name, arity) not in available]
        if missing_rpcs:
            print("FAIL: missing photo job RPC signatures: " + ",".join(missing_rpcs))
            return False

    print("PASS: required job table columns and RPC signatures exist")
    return True


def main():
    url = os.environ.get("CARVAMO_OVH_DATABASE_URL", "")
    if not url:
        print("FAIL: CARVAMO_OVH_DATABASE_URL is not configured", file=sys.stderr)
        return 2
    try:
        import psycopg
        with psycopg.connect(url, connect_timeout=10) as conn:
            conn.execute("SET TRANSACTION READ ONLY")
            return 0 if check(conn) else 1
    except Exception as exc:
        # Never log exception text, which can contain database host or credentials.
        print("FAIL: PostgreSQL preflight: " + type(exc).__name__, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
