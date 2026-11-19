CREATE TABLE lejek_password_resets (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE REFERENCES lejek_credentials(email) ON DELETE CASCADE,
  credential_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
