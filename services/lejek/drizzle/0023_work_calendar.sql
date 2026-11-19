CREATE TABLE work_calendar (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('leave','saturday','other')),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  PRIMARY KEY(person,day)
);
