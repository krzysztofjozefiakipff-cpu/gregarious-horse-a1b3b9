CREATE TABLE work_calendar_expanded (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('leave','saturday','other','training','sick')),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  PRIMARY KEY(person,day)
);
INSERT INTO work_calendar_expanded SELECT person,day,kind,status FROM work_calendar;
DROP TABLE work_calendar;
ALTER TABLE work_calendar_expanded RENAME TO work_calendar;
