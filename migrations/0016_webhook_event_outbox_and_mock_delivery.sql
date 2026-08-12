CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  event_types_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  secret_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  webhook_event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  retry_of_delivery_id TEXT REFERENCES webhook_deliveries(id) ON DELETE SET NULL,
  request_idempotency_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL,
  signature TEXT NOT NULL,
  signature_timestamp TEXT NOT NULL,
  body_json TEXT NOT NULL,
  external_id TEXT,
  error TEXT,
  network_intent INTEGER NOT NULL DEFAULT 0 CHECK(network_intent = 0),
  created_at TEXT NOT NULL,
  UNIQUE(event_id, webhook_event_id, subscription_id, attempt_number),
  UNIQUE(event_id, request_idempotency_key, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event_id, enabled, updated_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event ON webhook_events(event_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id, webhook_event_id, subscription_id, attempt_number);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (16, 'webhook_event_outbox_and_mock_delivery', CURRENT_TIMESTAMP);
