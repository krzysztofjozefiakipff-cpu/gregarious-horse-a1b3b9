CREATE TABLE daily_briefing_settings (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  goals TEXT NOT NULL,
  forecast TEXT NOT NULL,
  baseline TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(person,day)
);

CREATE TABLE daily_briefing_reviews (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  actuals TEXT NOT NULL,
  goals TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  PRIMARY KEY(person,day)
);
