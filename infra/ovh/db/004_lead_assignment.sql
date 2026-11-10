-- CARVAMO staging: explicit lead ownership by a single dealer employee.
-- Apply after 001_core_schema.sql and 002_account_roles.sql.
BEGIN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_dealer_assignee_idx ON leads(dealer_id, assigned_to, created_at DESC);
CREATE OR REPLACE FUNCTION carvamo_guard_lead_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_role text; target_dealer uuid; target_enabled boolean;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT role,dealer_id,enabled INTO target_role,target_dealer,target_enabled
    FROM users WHERE id=NEW.assigned_to;
    IF NOT FOUND OR target_role <> 'dealer_staff' OR target_dealer IS DISTINCT FROM NEW.dealer_id OR NOT coalesce(target_enabled,false) THEN
      RAISE EXCEPTION 'Lead assignee must be an active staff member of the same dealer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS leads_assignment_guard ON leads;
CREATE TRIGGER leads_assignment_guard BEFORE INSERT OR UPDATE OF assigned_to,dealer_id ON leads
FOR EACH ROW EXECUTE FUNCTION carvamo_guard_lead_assignment();
COMMIT;
