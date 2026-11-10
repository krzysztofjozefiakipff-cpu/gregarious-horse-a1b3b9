BEGIN;
CREATE TABLE IF NOT EXISTS offer_specifications (
 offer_id uuid PRIMARY KEY REFERENCES offers(id) ON DELETE CASCADE,
 standard_equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
 optional_equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
 other_details jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_filename text,
 reviewed_by uuid REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT spec_standard_array CHECK (jsonb_typeof(standard_equipment)='array'),
 CONSTRAINT spec_optional_array CHECK (jsonb_typeof(optional_equipment)='array'),
 CONSTRAINT spec_other_object CHECK (jsonb_typeof(other_details)='object')
);
COMMIT;
