-- Idempotent staging-only demo dealerships. No real dealer data or users.
BEGIN;
INSERT INTO dealers(id,name,active) VALUES
('d0000000-0000-4000-8000-000000000001','DEMO CARVAMO — Dealer Warszawa',true),
('d0000000-0000-4000-8000-000000000002','DEMO CARVAMO — Dealer Poznań',true)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,active=true;
COMMIT;
