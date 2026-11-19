CREATE TABLE seller_source_plans (
  person INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,
  targets TEXT NOT NULL,
  PRIMARY KEY (person, month)
);

CREATE TRIGGER IF NOT EXISTS reset_source_plan_approval
AFTER UPDATE OF targets ON seller_source_plans WHEN OLD.targets IS NOT NEW.targets
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_first_source_plan_approval
AFTER INSERT ON seller_source_plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;
