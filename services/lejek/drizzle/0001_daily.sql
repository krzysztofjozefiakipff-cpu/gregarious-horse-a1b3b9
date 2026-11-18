CREATE TABLE daily_results (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  counters TEXT NOT NULL,
  PRIMARY KEY(person, day)
);
