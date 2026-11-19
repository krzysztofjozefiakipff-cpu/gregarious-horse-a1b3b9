CREATE TABLE report_exclusions (
  person INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE
);
