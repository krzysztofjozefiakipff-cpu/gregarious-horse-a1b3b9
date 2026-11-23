CREATE TABLE communication_departments (
  group_name TEXT NOT NULL REFERENCES dealer_groups(name) ON DELETE CASCADE,
  department TEXT NOT NULL CHECK(department IN ('carwash','logistics')),
  manager INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  PRIMARY KEY(group_name,department)
);
INSERT OR IGNORE INTO communication_departments(group_name,department)
SELECT group_name,department FROM communication_threads
WHERE kind='department' AND group_name IS NOT NULL
UNION
SELECT gs.group_name,cp.position FROM communication_positions cp JOIN dealer_group_salons gs USING(salon)
WHERE cp.position IN ('carwash','logistics');
