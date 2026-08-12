CREATE TABLE IF NOT EXISTS integration_connections (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_url TEXT,
  external_event_id TEXT,
  direction TEXT NOT NULL DEFAULT 'CALLBOARD_TO_ACCELEVENTS',
  mode TEXT NOT NULL DEFAULT 'mock',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  speaker_mapping_json TEXT NOT NULL DEFAULT '{}',
  session_mapping_json TEXT NOT NULL DEFAULT '{}',
  external_snapshot_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(event_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  config_version INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL,
  retry_of_run_id TEXT REFERENCES integration_sync_runs(id) ON DELETE SET NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  network_intent INTEGER NOT NULL DEFAULT 0 CHECK(network_intent IN (0, 1)),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_sync_operations (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES integration_sync_runs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  external_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, local_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_runs_event_provider ON integration_sync_runs(event_id, provider, completed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_runs_config_version ON integration_sync_runs(event_id, provider, config_version);
CREATE INDEX IF NOT EXISTS idx_integration_operations_run ON integration_sync_operations(run_id, status, entity_type);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (14, 'shared_integration_preflight', CURRENT_TIMESTAMP);
