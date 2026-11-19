CREATE TABLE seller_plan_approvals (
  person INTEGER NOT NULL REFERENCES accounts(id),
  month TEXT NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY (person, month)
);

CREATE TABLE salon_plan_approval_sets (
  salon TEXT NOT NULL,
  month TEXT NOT NULL,
  approvals TEXT NOT NULL,
  PRIMARY KEY (salon, month)
);

CREATE TRIGGER IF NOT EXISTS reset_plans_approval_insert
AFTER INSERT ON plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_plans_approval_update
AFTER UPDATE ON plans WHEN OLD.target IS NOT NEW.target
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_plans_approval_delete
AFTER DELETE ON plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=OLD.person AND month=OLD.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_review_plans_approval_insert
AFTER INSERT ON review_plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_review_plans_approval_update
AFTER UPDATE ON review_plans WHEN OLD.target IS NOT NEW.target
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_review_plans_approval_delete
AFTER DELETE ON review_plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=OLD.person AND month=OLD.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_funnel_plans_approval_insert
AFTER INSERT ON funnel_plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_funnel_plans_approval_update
AFTER UPDATE ON funnel_plans WHEN OLD.targets IS NOT NEW.targets
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=NEW.person AND month=NEW.month;
END;

CREATE TRIGGER IF NOT EXISTS reset_funnel_plans_approval_delete
AFTER DELETE ON funnel_plans
BEGIN
  DELETE FROM seller_plan_approvals WHERE person=OLD.person AND month=OLD.month;
END;
