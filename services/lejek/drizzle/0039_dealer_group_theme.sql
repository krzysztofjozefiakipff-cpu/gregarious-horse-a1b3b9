CREATE TABLE dealer_group_theme (
  group_name TEXT PRIMARY KEY REFERENCES dealer_groups(name) ON DELETE CASCADE,
  primary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL
);
