CREATE TABLE communication_positions (
  email TEXT PRIMARY KEY,
  salon TEXT NOT NULL,
  position TEXT NOT NULL CHECK(position IN ('reception','sales_assistant','carwash','logistics'))
);
CREATE TABLE communication_threads (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('direct','announcement','department')),
  title TEXT NOT NULL,
  group_name TEXT REFERENCES dealer_groups(name),
  department TEXT
);
CREATE TABLE communication_participants (
  thread TEXT NOT NULL REFERENCES communication_threads(id),
  email TEXT NOT NULL,
  PRIMARY KEY(thread,email)
);
CREATE TABLE communication_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread TEXT NOT NULL REFERENCES communication_threads(id),
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE communication_reads (
  thread TEXT NOT NULL REFERENCES communication_threads(id),
  email TEXT NOT NULL,
  last_read INTEGER NOT NULL,
  PRIMARY KEY(thread,email)
);
CREATE INDEX IF NOT EXISTS communication_participants_email ON communication_participants(email,thread);
CREATE INDEX IF NOT EXISTS communication_messages_thread ON communication_messages(thread,id);

CREATE TABLE communication_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS communication_events_person ON communication_events(person,id);

CREATE TRIGGER IF NOT EXISTS communication_calendar_resolution
AFTER UPDATE OF status ON work_calendar WHEN OLD.status<>NEW.status AND NEW.status IN ('approved','rejected')
BEGIN
  INSERT INTO communication_events(person,kind,subject) VALUES (NEW.person,'calendar_'||NEW.status,NEW.day);
END;

CREATE TRIGGER IF NOT EXISTS communication_plan_approval
AFTER INSERT ON seller_plan_approvals
BEGIN
  INSERT INTO communication_events(person,kind,subject) VALUES (NEW.person,'plan_approved',NEW.month);
END;
