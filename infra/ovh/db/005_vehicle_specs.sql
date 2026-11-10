BEGIN;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS trim_name varchar(120);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS engine_name varchar(120);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS power_hp integer;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS drive_type varchar(12);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS transmission_type varchar(32);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS catalog_source varchar(24) NOT NULL DEFAULT 'manual';
DO $ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_power_hp_valid' AND conrelid='offers'::regclass) THEN
  ALTER TABLE offers ADD CONSTRAINT offers_power_hp_valid CHECK (power_hp IS NULL OR power_hp BETWEEN 1 AND 3000);
 END IF;
END $;
COMMIT;
