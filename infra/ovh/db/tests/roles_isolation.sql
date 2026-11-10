-- Transactional staging tests. No persistent test users or dealers.
BEGIN;
ALTER TABLE users DISABLE TRIGGER users_guard;
INSERT INTO dealers(id,name) VALUES
('10000000-0000-4000-8000-000000000001','TEST Dealer A'),
('10000000-0000-4000-8000-000000000002','TEST Dealer B');
INSERT INTO users(id,email,role,dealer_id,enabled) VALUES
('20000000-0000-4000-8000-000000000001','test-admin@example.invalid','admin',NULL,true),
('20000000-0000-4000-8000-000000000002','test-dealer-admin-a@example.invalid','dealer_admin','10000000-0000-4000-8000-000000000001',true),
('20000000-0000-4000-8000-000000000003','test-dealer-admin-b@example.invalid','dealer_admin','10000000-0000-4000-8000-000000000002',true);
ALTER TABLE users ENABLE TRIGGER users_guard;
DO $$
BEGIN
 IF NOT carvamo_can_manage_account('20000000-0000-4000-8000-000000000001','dealer_admin','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'admin cannot manage dealer'; END IF;
 IF NOT carvamo_can_manage_account('20000000-0000-4000-8000-000000000002','dealer_staff','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'dealer admin cannot manage own staff'; END IF;
 IF carvamo_can_manage_account('20000000-0000-4000-8000-000000000002','dealer_admin','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'dealer admin can grant admin'; END IF;
 IF carvamo_can_manage_account('20000000-0000-4000-8000-000000000002','dealer_staff','10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'dealer admin can manage other dealer'; END IF;
 IF carvamo_can_access_dealer('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'dealer isolation broken'; END IF;
END $$;
SELECT set_config('carvamo.actor_id','20000000-0000-4000-8000-000000000002',true);
INSERT INTO users(email,role,dealer_id,enabled)
VALUES ('test-dealer-staff-a@example.invalid','dealer_staff','10000000-0000-4000-8000-000000000001',true);
DO $$
BEGIN
 BEGIN
   INSERT INTO users(email,role,dealer_id,enabled)
   VALUES ('test-cross-dealer@example.invalid','dealer_staff','10000000-0000-4000-8000-000000000002',true);
   RAISE EXCEPTION 'cross dealer write succeeded';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM = 'cross dealer write succeeded' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
