ALTER TABLE tasks ADD COLUMN instructions TEXT;

CREATE TABLE IF NOT EXISTS file_requests (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Contact',
  instructions TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_releases (
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  published_at TEXT,
  released_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_forms (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Contact',
  schema_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE file_metadata ADD COLUMN file_request_id TEXT REFERENCES file_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_file_requests_event ON file_requests(event_id, type);
CREATE INDEX IF NOT EXISTS idx_portal_forms_event ON portal_forms(event_id, type);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (5, 'portal_file_requests_and_schedule_release', CURRENT_TIMESTAMP);
