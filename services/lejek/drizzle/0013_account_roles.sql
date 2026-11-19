CREATE TABLE account_roles (
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('group','manager','seller')),
  PRIMARY KEY(person,role)
);
