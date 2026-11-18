CREATE TABLE meme_assignments (
  person INTEGER NOT NULL REFERENCES accounts(id),
  salon TEXT NOT NULL,
  day TEXT NOT NULL,
  title TEXT NOT NULL,
  PRIMARY KEY(person, day),
  UNIQUE(salon, day, title)
);
CREATE INDEX IF NOT EXISTS meme_assignments_history ON meme_assignments(salon, title, day);
