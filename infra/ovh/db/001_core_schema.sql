BEGIN;
CREATE TABLE IF NOT EXISTS dealers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text UNIQUE NOT NULL,
 password_hash text,
 role text NOT NULL DEFAULT 'dealer' CHECK (role IN ('admin','staff','dealer')),
 enabled boolean NOT NULL DEFAULT false,
 dealer_id uuid REFERENCES dealers(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS offers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 brand text NOT NULL, model text NOT NULL, body text NOT NULL, fuel text NOT NULL,
 gross_price numeric(14,2) NOT NULL CHECK (gross_price>=0),
 dealer_id uuid NOT NULL REFERENCES dealers(id),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','published','rejected','archived')),
 source text NOT NULL DEFAULT 'carvamo',
 special boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES users(id),
 deletion_pending boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offers_public_idx ON offers(status,dealer_id) WHERE deletion_pending=false;
CREATE TABLE IF NOT EXISTS offer_details (
 offer_id uuid PRIMARY KEY REFERENCES offers(id) ON DELETE CASCADE,
 version_name text, discount_terms text, purchase_terms text, financing_terms text,
 pickup_city text, availability_confirmed boolean NOT NULL DEFAULT false,
 availability_confirmed_at timestamptz, availability_confirmed_by uuid REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT confirmation_evidence CHECK (NOT availability_confirmed OR (availability_confirmed_at IS NOT NULL AND availability_confirmed_by IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS offer_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
 uploaded_by uuid REFERENCES users(id),
 original_path text NOT NULL,
 processed_path text,
 photo_type text NOT NULL DEFAULT 'unknown',
 background_mode text NOT NULL DEFAULT 'original',
 logo_version text NOT NULL DEFAULT 'carvamo-v1',
 logo_applied boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'review',
 is_cover boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES users(id),
 reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 offer_id uuid NOT NULL REFERENCES offers(id),
 dealer_id uuid NOT NULL REFERENCES dealers(id),
 full_name text NOT NULL, email text NOT NULL, phone text NOT NULL,
 message text, attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','unqualified')),
 qualified_at timestamptz, qualified_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_campaign_idx ON leads(created_at DESC);
CREATE TABLE IF NOT EXISTS photo_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 photo_id uuid NOT NULL REFERENCES offer_photos(id),
 requested_by uuid REFERENCES users(id),
 target_mode text NOT NULL,
 state text NOT NULL DEFAULT 'queued',
 attempts smallint NOT NULL DEFAULT 0,
 provider text NOT NULL DEFAULT 'not_configured',
 error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz, finished_at timestamptz,
 progress_percent smallint NOT NULL DEFAULT 0,
 progress_stage text NOT NULL DEFAULT 'queued'
);
COMMIT;
