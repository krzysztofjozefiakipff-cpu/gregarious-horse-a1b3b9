CREATE TABLE salon_plans (
  salon TEXT NOT NULL,
  month TEXT NOT NULL,
  manager INTEGER NOT NULL REFERENCES accounts(id),
  targets TEXT NOT NULL,
  PRIMARY KEY (salon, month)
);
