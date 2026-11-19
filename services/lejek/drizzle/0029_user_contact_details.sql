CREATE TABLE account_contact_details (
  person INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL
);
