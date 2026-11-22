"""Offline tests for the read-only OVH PostgreSQL queue preflight."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from probe_ovh_database import check, REQUIRED_COLUMNS, REQUIRED_FUNCTIONS


class FakeCursor:
    def __init__(self, columns, functions):
        self.results = [tuple([name]) for name in columns]
        self.columns = self.results
        self.functions = list(functions)
        self.calls = 0

    def execute(self, sql, params=None):
        self.calls += 1
        self.results = self.columns if self.calls == 1 else self.functions

    def fetchall(self):
        return self.results

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class FakeConn:
    def __init__(self, columns, functions):
        self.cur = FakeCursor(columns, functions)

    def cursor(self):
        return self.cur


class DatabasePreflightTests(unittest.TestCase):
    def test_all_requirements_present(self):
        conn = FakeConn(REQUIRED_COLUMNS, REQUIRED_FUNCTIONS.items())
        self.assertTrue(check(conn))
        self.assertEqual(conn.cur.calls, 2)

    def test_missing_column(self):
        conn = FakeConn(REQUIRED_COLUMNS - {"progress_at"}, REQUIRED_FUNCTIONS.items())
        self.assertFalse(check(conn))
        self.assertEqual(conn.cur.calls, 1)

    def test_missing_rpc(self):
        conn = FakeConn(REQUIRED_COLUMNS, [("cv_ai_claim", 1)])
        self.assertFalse(check(conn))


if __name__ == "__main__":
    unittest.main()
