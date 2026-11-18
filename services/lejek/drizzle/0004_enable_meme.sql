BEGIN IMMEDIATE;
CREATE TABLE lejek_migrations (
  name TEXT PRIMARY KEY
);
INSERT INTO dashboard_sidebar (id, mode)
SELECT 1, 'meme'
WHERE NOT EXISTS (SELECT 1 FROM lejek_migrations WHERE name = '0004_enable_meme')
ON CONFLICT(id) DO UPDATE SET mode = excluded.mode;
INSERT INTO lejek_migrations (name) VALUES ('0004_enable_meme') ON CONFLICT DO NOTHING;
COMMIT;
