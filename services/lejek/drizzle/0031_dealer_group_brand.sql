CREATE TABLE dealer_group_brand (
  group_name TEXT PRIMARY KEY REFERENCES dealer_groups(name) ON DELETE CASCADE,
  logo TEXT NOT NULL
);
