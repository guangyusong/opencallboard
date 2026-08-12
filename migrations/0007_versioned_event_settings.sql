ALTER TABLE events ADD COLUMN location TEXT;
ALTER TABLE events ADD COLUMN website_url TEXT;
ALTER TABLE events ADD COLUMN event_type TEXT;
ALTER TABLE events ADD COLUMN theme TEXT;
ALTER TABLE events ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (7, 'versioned_event_settings', CURRENT_TIMESTAMP);
