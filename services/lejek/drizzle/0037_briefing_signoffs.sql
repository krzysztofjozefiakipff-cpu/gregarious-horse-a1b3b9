CREATE TABLE daily_briefing_signoffs (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  accepted_plan TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  completed_version TEXT,
  completed_at TEXT,
  PRIMARY KEY(person,day)
);
