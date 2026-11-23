CREATE TABLE account_roles_updated (
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('group','manager','seller','staff','reception','sales_assistant',
    'carwash','logistics','carwash_manager','logistics_manager')),
  PRIMARY KEY(person,role)
);
INSERT INTO account_roles_updated SELECT person,role FROM account_roles;
DROP TABLE account_roles;
ALTER TABLE account_roles_updated RENAME TO account_roles;

ALTER TABLE communication_departments ADD COLUMN name TEXT;
UPDATE communication_departments
SET name=CASE department WHEN 'carwash' THEN 'Myjnia' ELSE 'Logistyka i transport' END;

CREATE TABLE communication_department_members (
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  department TEXT NOT NULL,
  PRIMARY KEY(person, department),
  FOREIGN KEY(group_name,department) REFERENCES communication_departments(group_name,department) ON DELETE CASCADE
);
INSERT INTO communication_department_members(person,group_name,department)
SELECT a.id,gs.group_name,cp.position FROM communication_positions cp
JOIN accounts a ON a.email=cp.email AND a.salon=cp.salon
JOIN dealer_group_salons gs ON gs.salon=a.salon
WHERE cp.position IN ('carwash','logistics');
INSERT OR IGNORE INTO account_roles
SELECT a.id,a.role FROM accounts a
WHERE (EXISTS(SELECT 1 FROM communication_positions cp WHERE cp.email=a.email AND cp.salon=a.salon)
  OR EXISTS(SELECT 1 FROM communication_departments d WHERE d.manager=a.id))
  AND NOT EXISTS(SELECT 1 FROM account_roles ar WHERE ar.person=a.id)
  AND NOT EXISTS(SELECT 1 FROM dealer_group_heads h WHERE h.email=a.email)
  AND a.role IN ('seller','manager');
INSERT OR IGNORE INTO account_roles
SELECT a.id,'group' FROM accounts a JOIN dealer_group_heads h ON h.email=a.email
WHERE (EXISTS(SELECT 1 FROM communication_positions cp WHERE cp.email=a.email AND cp.salon=a.salon)
  OR EXISTS(SELECT 1 FROM communication_departments d WHERE d.manager=a.id));
INSERT OR IGNORE INTO account_roles
SELECT a.id,cp.position FROM accounts a JOIN communication_positions cp ON cp.email=a.email AND cp.salon=a.salon
WHERE cp.position IN ('reception','sales_assistant') AND a.role<>'admin';
INSERT OR IGNORE INTO account_roles
SELECT person,department FROM communication_department_members;
INSERT OR IGNORE INTO account_roles
SELECT manager,department||'_manager' FROM communication_departments WHERE manager IS NOT NULL;

DELETE FROM account_roles WHERE role='staff' AND person IN (
  SELECT person FROM account_roles WHERE role IN ('reception','sales_assistant')
);

CREATE TABLE communication_department_accounts (
  person INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL REFERENCES dealer_groups(name) ON DELETE CASCADE
);
