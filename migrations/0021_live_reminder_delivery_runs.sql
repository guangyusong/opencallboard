CREATE TABLE communication_reminder_runs_v21 (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL REFERENCES communication_reminders(id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  evaluated_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('materialized_preview', 'skipped_no_recipients', 'blocked_template', 'queued_live', 'failed_delivery', 'blocked_delivery')),
  matched_recipient_count INTEGER NOT NULL DEFAULT 0,
  outbox_id TEXT REFERENCES communication_outbox(id) ON DELETE SET NULL,
  error_code TEXT,
  network_intent INTEGER NOT NULL DEFAULT 0 CHECK(network_intent IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE(event_id, automation_key)
);

INSERT INTO communication_reminder_runs_v21 (
  id, event_id, reminder_id, automation_key, source_type, source_id,
  evaluated_at, due_at, status, matched_recipient_count, outbox_id,
  error_code, network_intent, created_at
)
SELECT
  id, event_id, reminder_id, automation_key, source_type, source_id,
  evaluated_at, due_at, status, matched_recipient_count, outbox_id,
  error_code, network_intent, created_at
FROM communication_reminder_runs;

DROP TABLE communication_reminder_runs;
ALTER TABLE communication_reminder_runs_v21 RENAME TO communication_reminder_runs;

CREATE INDEX idx_communication_reminder_runs_event
ON communication_reminder_runs(event_id, evaluated_at DESC, id DESC);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (21, 'live_reminder_delivery_runs', CURRENT_TIMESTAMP);
