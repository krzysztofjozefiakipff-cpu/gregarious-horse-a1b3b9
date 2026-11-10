BEGIN;
CREATE OR REPLACE FUNCTION carvamo_protect_user_changes()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; actor_role text; actor_dealer uuid; actor_enabled boolean;
BEGIN
 actor:=nullif(current_setting('carvamo.actor_id',true),'')::uuid;
 IF actor IS NULL THEN RAISE EXCEPTION 'User mutations require authenticated actor context'; END IF;
 SELECT role,dealer_id,enabled INTO actor_role,actor_dealer,actor_enabled FROM users WHERE id=actor;
 IF NOT coalesce(actor_enabled,false) THEN RAISE EXCEPTION 'Inactive actor'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Delete forbidden; deactivate instead'; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email)
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Immutable account identity'; END IF;
   IF actor=OLD.id AND NEW.role=OLD.role AND NEW.dealer_id IS NOT DISTINCT FROM OLD.dealer_id
      AND NEW.enabled=OLD.enabled THEN
     RETURN NEW; -- self-service password change without role or status changes
   END IF;
   IF actor=OLD.id THEN RAISE EXCEPTION 'Self privilege changes forbidden'; END IF;
   IF actor_role='dealer_admin' AND
     (OLD.role <> 'dealer_staff' OR NEW.role <> 'dealer_staff'
      OR OLD.dealer_id IS DISTINCT FROM actor_dealer OR NEW.dealer_id IS DISTINCT FROM actor_dealer)
   THEN RAISE EXCEPTION 'Dealer administrator can manage dealer staff only'; END IF;
   IF OLD.role='admin' THEN RAISE EXCEPTION 'Administrator changes require separate recovery procedure'; END IF;
 END IF;
 IF NOT carvamo_can_manage_account(actor,NEW.role,NEW.dealer_id)
 THEN RAISE EXCEPTION 'Account management denied'; END IF;
 RETURN NEW;
END;
$$;
COMMIT;
