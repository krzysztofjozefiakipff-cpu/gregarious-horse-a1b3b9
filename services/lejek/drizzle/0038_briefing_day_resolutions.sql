CREATE TABLE daily_briefing_day_resolutions (
  id TEXT PRIMARY KEY,
  person INTEGER NOT NULL REFERENCES accounts(id),
  briefing_day TEXT NOT NULL,
  reviewed_day TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  outcome TEXT NOT NULL,
  draft_rows TEXT,
  resolved_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS daily_briefing_day_resolutions_lookup ON daily_briefing_day_resolutions(briefing_day,person);
