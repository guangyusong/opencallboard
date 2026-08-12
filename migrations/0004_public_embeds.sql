CREATE TABLE IF NOT EXISTS embeds (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'Styled HTML',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_embeds_event ON embeds(event_id, enabled);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (4, 'public_embed_configuration', CURRENT_TIMESTAMP);
