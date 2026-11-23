ALTER TABLE lejek_sessions ADD COLUMN remembered INTEGER NOT NULL DEFAULT 0 CHECK (remembered IN (0, 1));

-- Only the previous remembered sessions could have more than eight hours remaining.
UPDATE lejek_sessions SET remembered = 1
WHERE expires_at > unixepoch() * 1000 + 8 * 60 * 60 * 1000 + 1000;
