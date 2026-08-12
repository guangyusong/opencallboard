CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_event ON api_tokens(event_id, revoked_at, expires_at);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (15, 'scoped_api_tokens_and_cursor_pagination', CURRENT_TIMESTAMP);
