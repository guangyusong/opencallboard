CREATE TABLE IF NOT EXISTS communication_reminder_runs (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL REFERENCES communication_reminders(id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  evaluated_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('materialized_preview', 'skipped_no_recipients', 'blocked_template')),
  matched_recipient_count INTEGER NOT NULL DEFAULT 0,
  outbox_id TEXT REFERENCES communication_outbox(id) ON DELETE SET NULL,
  error_code TEXT,
  network_intent INTEGER NOT NULL DEFAULT 0 CHECK(network_intent = 0),
  created_at TEXT NOT NULL,
  UNIQUE(event_id, automation_key)
);

CREATE INDEX IF NOT EXISTS idx_communication_reminder_runs_event
ON communication_reminder_runs(event_id, evaluated_at DESC, id DESC);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (18, 'scheduled_reminder_preview_runs', CURRENT_TIMESTAMP);
