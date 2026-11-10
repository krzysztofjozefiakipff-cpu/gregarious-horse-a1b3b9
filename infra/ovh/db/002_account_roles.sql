-- CARVAMO OVH: role hierarchy, dealer isolation and audit trail.
-- Requires 001_core_schema.sql. No existing users are promoted by this migration.
BEGIN;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','staff','dealer','dealer_admin','dealer_staff'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_dealer_scope_check;
ALTER TABLE users ADD CONSTRAINT users_dealer_scope_check CHECK (
 (role IN ('admin','staff') AND dealer_id IS NULL)
 OR (role IN ('dealer','dealer_admin','dealer_staff') AND dealer_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_unique ON users(lower(email));
CREATE INDEX IF NOT EXISTS users_dealer_role_idx ON users(dealer_id,role) WHERE enabled=true;
CREATE TABLE IF NOT EXISTS account_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 target_id uuid REFERENCES users(id) ON DELETE SET NULL,
 dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL,
 action text NOT NULL CHECK (action IN ('invite','create','activate','deactivate','role_change','password_reset','revoke_sessions')),
 old_role text,
 new_role text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_audit_dealer_time_idx ON account_audit(dealer_id,created_at DESC);
CREATE OR REPLACE FUNCTION carvamo_can_manage_account(
 actor uuid, target_role text, target_dealer uuid
) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
 SELECT 1 FROM users u
 WHERE u.id=actor AND u.enabled
 AND (
   (u.role='admin' AND (
     (target_role IN ('admin','staff') AND target_dealer IS NULL)
     OR (target_role IN ('dealer','dealer_admin','dealer_staff') AND target_dealer IS NOT NULL)
   ))
   OR (u.role='dealer_admin' AND target_role='dealer_staff'
       AND target_dealer=u.dealer_id AND target_dealer IS NOT NULL)
 )
 );
$$;
CREATE OR REPLACE FUNCTION carvamo_can_access_dealer(
 actor uuid, target_dealer uuid
) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
 SELECT 1 FROM users u WHERE u.id=actor AND u.enabled
 AND (u.role IN ('admin','staff') OR (u.dealer_id=target_dealer AND target_dealer IS NOT NULL))
 );
$$;
CREATE OR REPLACE FUNCTION carvamo_protect_user_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; actor_role text; actor_dealer uuid; actor_enabled boolean;
BEGIN
 actor:=nullif(current_setting('carvamo.actor_id',true),'')::uuid;
 IF actor IS NULL THEN
   RAISE EXCEPTION 'User mutations require authenticated actor context';
 END IF;
 SELECT role,dealer_id,enabled INTO actor_role,actor_dealer,actor_enabled FROM users WHERE id=actor;
 IF NOT coalesce(actor_enabled,false) THEN RAISE EXCEPTION 'Inactive actor'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Delete forbidden; deactivate instead'; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email)
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
     RAISE EXCEPTION 'Immutable account identity';
   END IF;
   IF actor=OLD.id AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id OR NEW.enabled IS DISTINCT FROM OLD.enabled)
   THEN RAISE EXCEPTION 'Self-privilege or self-deactivation forbidden'; END IF;
   IF actor_role='dealer_admin' AND
     (OLD.role <> 'dealer_staff' OR NEW.role <> 'dealer_staff'
      OR OLD.dealer_id IS DISTINCT FROM actor_dealer OR NEW.dealer_id IS DISTINCT FROM actor_dealer)
   THEN RAISE EXCEPTION 'Dealer administrator can manage dealer staff only'; END IF;
   IF actor_role='admin' AND OLD.role='admin' AND OLD.id<>actor
   THEN RAISE EXCEPTION 'Administrator changes require separate privileged recovery procedure'; END IF;
 END IF;
 IF NOT carvamo_can_manage_account(actor,NEW.role,NEW.dealer_id)
 THEN RAISE EXCEPTION 'Account management denied'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS users_guard ON users;
CREATE TRIGGER users_guard BEFORE INSERT OR UPDATE OR DELETE ON users
 FOR EACH ROW EXECUTE FUNCTION carvamo_protect_user_changes();
-- Application DB account must be non-owner and must not have BYPASSRLS.
-- Provisioning the first administrator is a separately audited operator action.
COMMIT;
