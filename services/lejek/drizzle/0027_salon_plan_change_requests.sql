CREATE TABLE direct_salon_plan_owners (
  salon TEXT NOT NULL,
  month TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager','group')),
  PRIMARY KEY (salon, month),
  FOREIGN KEY (salon, month) REFERENCES direct_salon_plans(salon, month)
);

CREATE VIEW IF NOT EXISTS protected_direct_salon_plans AS
SELECT p.salon,p.month,p.targets FROM direct_salon_plans p
LEFT JOIN direct_salon_plan_owners o USING (salon,month)
WHERE o.role='group' OR (o.role IS NULL AND EXISTS (
  SELECT 1 FROM dealer_group_salons g WHERE g.salon=p.salon
));

CREATE TABLE salon_plan_change_requests (
  id INTEGER PRIMARY KEY,
  salon TEXT NOT NULL,
  month TEXT NOT NULL,
  requester INTEGER NOT NULL REFERENCES accounts(id),
  base_targets TEXT NOT NULL,
  proposed_targets TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  FOREIGN KEY (salon, month) REFERENCES direct_salon_plans(salon, month)
);

CREATE UNIQUE INDEX IF NOT EXISTS salon_plan_one_pending_change
ON salon_plan_change_requests(salon,month) WHERE status='pending';
