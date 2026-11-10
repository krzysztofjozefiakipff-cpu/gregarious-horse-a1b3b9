BEGIN;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS preview_confirmed_at timestamptz;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS preview_confirmed_by uuid REFERENCES users(id);
COMMIT;
