CREATE TABLE daily_drafts (
  person INTEGER NOT NULL REFERENCES accounts(id),
  day TEXT NOT NULL,
  rows TEXT NOT NULL,
  PRIMARY KEY(person, day)
);

CREATE TRIGGER IF NOT EXISTS clear_daily_draft_after_approval
AFTER INSERT ON daily_results
BEGIN
  DELETE FROM daily_drafts WHERE person=NEW.person AND day=NEW.day;
END;
