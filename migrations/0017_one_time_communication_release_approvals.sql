CREATE TABLE IF NOT EXISTS communication_release_approvals (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  outbox_id TEXT NOT NULL REFERENCES communication_outbox(id) ON DELETE CASCADE,
  approval_hash TEXT NOT NULL UNIQUE,
  active_slot TEXT UNIQUE,
  exact_payload_hash TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_enqueue' CHECK(status IN ('pending_enqueue', 'queued', 'dispatching', 'succeeded', 'failed', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  enqueued_at TEXT,
  dispatch_started_at TEXT,
  used_at TEXT,
  revoked_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_release_outbox
ON communication_release_approvals(event_id, outbox_id, status, expires_at);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (17, 'one_time_communication_release_approvals', CURRENT_TIMESTAMP);
