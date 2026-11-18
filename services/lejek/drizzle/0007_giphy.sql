CREATE TABLE giphy_preference (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
);
CREATE TABLE giphy_daily (
  person INTEGER NOT NULL REFERENCES accounts(id),
  salon TEXT NOT NULL,
  day TEXT NOT NULL,
  gif_id TEXT NOT NULL,
  PRIMARY KEY(person,day),
  UNIQUE(salon,day,gif_id)
);
