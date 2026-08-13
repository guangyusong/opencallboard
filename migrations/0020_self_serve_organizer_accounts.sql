CREATE TABLE IF NOT EXISTS account_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizer_login_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT,
  request_ip_hash TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_sessions_user
ON account_sessions(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_organizer_login_email
ON organizer_login_challenges(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organizer_login_ip
ON organizer_login_challenges(request_ip_hash, created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (20, 'self_serve_organizer_accounts', CURRENT_TIMESTAMP);
