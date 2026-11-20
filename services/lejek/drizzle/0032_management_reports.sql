CREATE TABLE management_report_events (
  email TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('login','read')),
  local_time TEXT NOT NULL,
  PRIMARY KEY (email, day, kind)
);
CREATE TABLE management_daily_reports (
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager','group')),
  day TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (email, role, day)
);
