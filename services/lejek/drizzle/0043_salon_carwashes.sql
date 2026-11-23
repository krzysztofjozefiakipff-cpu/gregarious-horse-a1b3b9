CREATE TABLE communication_departments_new (
  group_name TEXT NOT NULL REFERENCES dealer_groups(name) ON DELETE CASCADE,
  department TEXT NOT NULL,
  manager INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  salon TEXT,
  type TEXT GENERATED ALWAYS AS (CASE department WHEN 'logistics' THEN 'logistics' ELSE 'carwash' END) VIRTUAL,
  CHECK(department IN ('logistics','carwash') OR department GLOB 'carwash:*'),
  CHECK(department<>'logistics' OR salon IS NULL),
  PRIMARY KEY(group_name,department),
  UNIQUE(group_name,salon)
);
INSERT INTO communication_departments_new(group_name,department,manager,name,salon)
SELECT d.group_name,d.department,d.manager,COALESCE(d.name,CASE d.department WHEN 'carwash' THEN 'Myjnia' ELSE 'Logistyka i transport' END),
  CASE WHEN d.department='carwash' THEN (
    SELECT CASE WHEN count(DISTINCT gs.salon)=1 THEN min(gs.salon) END
    FROM dealer_group_salons gs WHERE gs.group_name=d.group_name
      AND NOT EXISTS (
        SELECT 1 FROM accounts a WHERE a.salon<>'' AND a.salon<>gs.salon AND (a.id=d.manager OR EXISTS (
          SELECT 1 FROM communication_department_members m WHERE m.person=a.id AND m.group_name=d.group_name AND m.department=d.department))
      )
  ) END
FROM communication_departments d;

CREATE TEMP TABLE carwash_members_backup AS SELECT * FROM communication_department_members;
DROP TABLE communication_department_members;
DROP TABLE communication_departments;
ALTER TABLE communication_departments_new RENAME TO communication_departments;
CREATE TABLE communication_department_members (
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  department TEXT NOT NULL,
  PRIMARY KEY(person, department),
  FOREIGN KEY(group_name,department) REFERENCES communication_departments(group_name,department) ON DELETE CASCADE
);
INSERT INTO communication_department_members SELECT person,group_name,department FROM carwash_members_backup;
DROP TABLE carwash_members_backup;
ALTER TABLE communication_department_accounts ADD COLUMN salon TEXT;
