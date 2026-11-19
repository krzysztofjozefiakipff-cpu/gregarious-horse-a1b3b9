CREATE TABLE seller_source_profiles (
  person INTEGER PRIMARY KEY REFERENCES accounts(id),
  shares TEXT NOT NULL
);
