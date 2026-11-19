CREATE TABLE direct_salon_plans (
  salon TEXT NOT NULL,
  month TEXT NOT NULL,
  targets TEXT NOT NULL,
  PRIMARY KEY (salon, month)
);
