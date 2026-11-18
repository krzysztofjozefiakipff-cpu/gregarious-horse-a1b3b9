CREATE TABLE review_plans (
  person INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,
  target INTEGER NOT NULL,
  PRIMARY KEY(person,month)
);
