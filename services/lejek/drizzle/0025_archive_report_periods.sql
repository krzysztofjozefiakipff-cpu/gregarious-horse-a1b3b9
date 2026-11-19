CREATE TABLE archive_report_periods (
  email TEXT NOT NULL,
  from_month TEXT NOT NULL,
  until_month TEXT,
  PRIMARY KEY (email, from_month),
  CHECK (until_month IS NULL OR until_month >= from_month)
);
