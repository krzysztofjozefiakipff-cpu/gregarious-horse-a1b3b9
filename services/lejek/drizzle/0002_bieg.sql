CREATE TABLE daily_tracking (
  person INTEGER PRIMARY KEY REFERENCES accounts(id),
  start_day TEXT NOT NULL
);
CREATE TABLE daily_exceptions (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('leave','training','pending','zero','rejected')),
  reason TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(person, day)
);
CREATE TABLE dealer_brand (
  salon TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT NOT NULL
);
CREATE TABLE charity_causes (
  month TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL
);
