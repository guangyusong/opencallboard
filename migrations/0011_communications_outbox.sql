CREATE TABLE IF NOT EXISTS communication_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  template_id TEXT,
  template_name TEXT NOT NULL,
  segment TEXT NOT NULL,
  recipients_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TEXT,
  calendar_json TEXT,
  exact_payload_json TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'none',
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS communication_delivery_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  outbox_id TEXT NOT NULL REFERENCES communication_outbox(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'none',
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(outbox_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS calendar_event_previews (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  method TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  location TEXT,
  outbox_id TEXT NOT NULL REFERENCES communication_outbox(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(event_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_communication_outbox_event_status ON communication_outbox(event_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_communication_attempts_outbox ON communication_delivery_attempts(event_id, outbox_id, attempt_number);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (11, 'communications_outbox', CURRENT_TIMESTAMP);
