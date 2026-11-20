CREATE TABLE daily_briefing_result_corrections (
  id INTEGER PRIMARY KEY,
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  previous_counters TEXT NOT NULL,
  corrected_counters TEXT NOT NULL,
  corrected_at TEXT NOT NULL
);
