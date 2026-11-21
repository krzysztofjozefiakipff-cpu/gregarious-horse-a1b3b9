CREATE TABLE account_roles_updated (
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('group','manager','seller','staff')),
  PRIMARY KEY(person,role)
);
INSERT INTO account_roles_updated SELECT person,role FROM account_roles;
DROP TABLE account_roles;
ALTER TABLE account_roles_updated RENAME TO account_roles;

CREATE TABLE salon_life_posts (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('salon','group')),
  audience TEXT NOT NULL,
  author TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  photo TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  published_day TEXT
);
CREATE INDEX salon_life_posts_feed ON salon_life_posts(scope,audience,status,published_day,id);
CREATE TABLE salon_life_reactions (
  post INTEGER NOT NULL REFERENCES salon_life_posts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  PRIMARY KEY(post,email)
);
CREATE TABLE salon_life_polls (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('salon','group')),
  audience TEXT NOT NULL,
  week TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  UNIQUE(scope,audience,week)
);
CREATE TABLE salon_life_poll_votes (
  poll INTEGER NOT NULL REFERENCES salon_life_polls(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  choice INTEGER NOT NULL,
  PRIMARY KEY(poll,email)
);
