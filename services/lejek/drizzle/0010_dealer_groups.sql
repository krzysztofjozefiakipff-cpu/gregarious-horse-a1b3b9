CREATE TABLE dealer_groups (
  name TEXT PRIMARY KEY
);
CREATE TABLE dealer_group_salons (
  salon TEXT PRIMARY KEY,
  group_name TEXT NOT NULL REFERENCES dealer_groups(name)
);
CREATE TABLE dealer_group_heads (
  email TEXT PRIMARY KEY,
  group_name TEXT NOT NULL REFERENCES dealer_groups(name)
);
CREATE TABLE funnel_plans (
  person INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,
  targets TEXT NOT NULL,
  PRIMARY KEY(person,month)
);
