CREATE TABLE lejek_credentials (
  email TEXT PRIMARY KEY REFERENCES accounts(email) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE lejek_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES lejek_credentials(email) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS lejek_sessions_email ON lejek_sessions(email);
