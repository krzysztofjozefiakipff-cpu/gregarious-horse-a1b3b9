-- CARVAMO private photo-worker queue; migration only, not deployed.
BEGIN;
ALTER TABLE photo_jobs
 ADD COLUMN IF NOT EXISTS lease_token_hash text,
 ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS candidate_path text,
 ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE INDEX IF NOT EXISTS photo_jobs_claim_idx ON photo_jobs(created_at,id)
 WHERE state='queued';
CREATE TABLE IF NOT EXISTS photo_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 photo_id uuid NOT NULL REFERENCES offer_photos(id) ON DELETE CASCADE,
 job_id uuid NOT NULL UNIQUE REFERENCES photo_jobs(id),
 candidate_path text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'review' CHECK (state IN ('review','approved','rejected')),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES users(id)
);
COMMIT;
