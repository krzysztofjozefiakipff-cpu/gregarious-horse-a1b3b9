CREATE TABLE archive_report_days (
  email TEXT NOT NULL,
  first_excluded_day TEXT NOT NULL,
  restored_day TEXT,
  PRIMARY KEY (email, first_excluded_day),
  CHECK (restored_day IS NULL OR restored_day >= first_excluded_day)
);

CREATE UNIQUE INDEX archive_report_days_open ON archive_report_days(email) WHERE restored_day IS NULL;

-- Legacy periods record months only. Retain the removal month and start excluding results the next month.
INSERT INTO archive_report_days (email,first_excluded_day,restored_day)
SELECT email,date(from_month||'-01','+1 month'),
  CASE WHEN until_month IS NOT NULL THEN until_month||'-01' END
FROM archive_report_periods
WHERE until_month IS NULL OR until_month||'-01'>date(from_month||'-01','+1 month');
