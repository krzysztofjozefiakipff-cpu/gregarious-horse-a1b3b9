CREATE TABLE lesson_packs (
  id INTEGER PRIMARY KEY,
  salon TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  published_day TEXT NOT NULL,
  lessons TEXT NOT NULL,
  UNIQUE(salon,name)
);

INSERT INTO lesson_packs(salon,name,active,published_day,lessons)
SELECT salon,'Lekcje opublikowane wcześniej',1,published_day,lessons FROM salon_lessons WHERE true
ON CONFLICT(salon,name) DO NOTHING;
