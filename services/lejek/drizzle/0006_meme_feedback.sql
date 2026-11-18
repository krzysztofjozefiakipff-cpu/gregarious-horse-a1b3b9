CREATE TABLE meme_reactions (
  person INTEGER NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY(person,day),
  FOREIGN KEY(person,day) REFERENCES meme_assignments(person,day)
);
CREATE TABLE meme_stories (
  id INTEGER PRIMARY KEY,
  person INTEGER NOT NULL REFERENCES accounts(id),
  title TEXT NOT NULL,
  caption TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))
);
