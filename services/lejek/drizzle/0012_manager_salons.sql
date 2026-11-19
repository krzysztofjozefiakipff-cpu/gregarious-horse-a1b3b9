CREATE TABLE manager_salons (
  manager INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  salon TEXT NOT NULL,
  PRIMARY KEY(manager,salon)
);
