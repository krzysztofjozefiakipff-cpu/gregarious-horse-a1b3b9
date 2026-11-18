CREATE TABLE meme_votes (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('local','giphy')),
  vote INTEGER NOT NULL CHECK(vote IN (-1,1)),
  PRIMARY KEY(person,day,source)
);
