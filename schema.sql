-- Callboard D1 schema v18. Applying this file is idempotent.
-- app_state remains only as a guarded compatibility bridge for the local-first UI.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  starts_at TEXT,
  ends_at TEXT,
  location TEXT,
  website_url TEXT,
  event_type TEXT,
  theme TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT,
  title TEXT,
  company TEXT,
  bio TEXT,
  headshot_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, email)
);

CREATE TABLE IF NOT EXISTS event_memberships (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('organizer', 'reviewer', 'speaker')),
  person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(event_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('organizer', 'reviewer', 'speaker')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY NOT NULL,
  grant_hash TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reviewer', 'speaker')),
  person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cfp_forms (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schema_json TEXT NOT NULL DEFAULT '{}',
  opens_at TEXT,
  closes_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_id TEXT REFERENCES cfp_forms(id) ON DELETE SET NULL,
  submitter_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  review_route TEXT,
  routing_rule_id TEXT,
  round INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cfp_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL REFERENCES cfp_forms(id) ON DELETE CASCADE,
  resume_token_hash TEXT NOT NULL UNIQUE,
  submitter_email TEXT NOT NULL COLLATE NOCASE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  participants_json TEXT NOT NULL DEFAULT '[]',
  step_name TEXT NOT NULL DEFAULT 'submission',
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  submitted_at TEXT,
  expires_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_people (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Speaker',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(submission_id, person_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  key TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(event_id, action, key)
);

CREATE TABLE IF NOT EXISTS evaluation_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  blind INTEGER NOT NULL DEFAULT 0 CHECK(blind IN (0, 1)),
  criteria_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, number)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id TEXT REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  scores_json TEXT NOT NULL DEFAULT '{}',
  total_score REAL,
  recommendation TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'assigned',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(submission_id, reviewer_user_id, round)
);

CREATE TABLE IF NOT EXISTS evaluation_decisions (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  notes TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT,
  ends_at TEXT,
  room TEXT,
  track TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_people (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES agenda_sessions(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'speaker',
  created_at TEXT NOT NULL,
  PRIMARY KEY(session_id, person_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assignee_person_id TEXT REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT,
  kind TEXT,
  instructions TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_requests (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assignee_person_id TEXT REFERENCES people(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Contact',
  instructions TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS schedule_releases (
  event_id TEXT PRIMARY KEY NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  published_at TEXT,
  released_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communication_templates (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Custom',
  segment TEXT NOT NULL DEFAULT 'all-speakers',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attach_calendar INTEGER NOT NULL DEFAULT 0 CHECK(attach_calendar IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communication_reminders (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  segment TEXT NOT NULL,
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL,
  timing TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS communication_previews (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Shared preview only',
  template_id TEXT,
  template_name TEXT NOT NULL,
  segment TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipients_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TEXT,
  attach_calendar INTEGER NOT NULL DEFAULT 0 CHECK(attach_calendar IN (0, 1)),
  exact_payload_json TEXT,
  matched_recipient_count INTEGER,
  automation_key TEXT,
  reminder_id TEXT,
  due_at TEXT,
  evaluated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT,
  content TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS file_metadata (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  owner_person_id TEXT REFERENCES people(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  file_request_id TEXT REFERENCES file_requests(id) ON DELETE SET NULL,
  kind TEXT,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Legacy compatibility table. New shared workflows use the normalized tables above.
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY NOT NULL,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_people_event ON people(event_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON event_memberships(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_hash ON auth_sessions(token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_access_grants_hash ON access_grants(grant_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_forms_event ON cfp_forms(event_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_event ON submissions(event_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_cfp_drafts_submitter ON cfp_drafts(event_id, form_id, submitter_email, submitted_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_submission_people_person ON submission_people(event_id, person_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_event ON evaluation_rounds(event_id, number);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(event_id, reviewer_user_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_round ON reviews(event_id, round_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_decisions_round ON evaluation_decisions(event_id, round_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_agenda_event_time ON agenda_sessions(event_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_submission ON agenda_sessions(event_id, submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(event_id, assignee_person_id, status);
CREATE INDEX IF NOT EXISTS idx_resources_event ON resources(event_id, audience);
CREATE INDEX IF NOT EXISTS idx_file_requests_event ON file_requests(event_id, type);
CREATE INDEX IF NOT EXISTS idx_file_requests_assignee ON file_requests(event_id, assignee_person_id, status);
CREATE INDEX IF NOT EXISTS idx_file_requests_submission ON file_requests(event_id, submission_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_forms_event ON portal_forms(event_id, type);
CREATE INDEX IF NOT EXISTS idx_communication_templates_event ON communication_templates(event_id, category);
CREATE INDEX IF NOT EXISTS idx_communication_reminders_event ON communication_reminders(event_id, enabled);
CREATE INDEX IF NOT EXISTS idx_communication_reminder_runs_event ON communication_reminder_runs(event_id, evaluated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_communication_previews_event ON communication_previews(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_communication_outbox_event_status ON communication_outbox(event_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_communication_attempts_outbox ON communication_delivery_attempts(event_id, outbox_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_integration_runs_event_provider ON integration_sync_runs(event_id, provider, completed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_runs_config_version ON integration_sync_runs(event_id, provider, config_version);
CREATE INDEX IF NOT EXISTS idx_integration_operations_run ON integration_sync_operations(run_id, status, entity_type);
CREATE INDEX IF NOT EXISTS idx_embeds_event ON embeds(event_id, enabled);
CREATE INDEX IF NOT EXISTS idx_files_owner ON file_metadata(event_id, owner_person_id);
CREATE INDEX IF NOT EXISTS idx_app_state_updated_at ON app_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_api_tokens_event ON api_tokens(event_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_communication_release_outbox ON communication_release_approvals(event_id, outbox_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_event ON webhook_subscriptions(event_id, enabled, updated_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event ON webhook_events(event_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id, webhook_event_id, subscription_id, attempt_number);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (2, 'normalized_event_workspace_and_server_sessions', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (3, 'review_submission_status', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (4, 'public_embed_configuration', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (5, 'portal_file_requests_and_schedule_release', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (6, 'preview_only_communications', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (7, 'versioned_event_settings', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (8, 'shared_evaluation_rounds', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (9, 'scoped_file_requests', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (10, 'public_cfp_drafts', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (11, 'communications_outbox', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (12, 'server_authoritative_submission_routing', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (13, 'submission_routing_assignments', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (14, 'shared_integration_preflight', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (15, 'scoped_api_tokens_and_cursor_pagination', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (16, 'webhook_event_outbox_and_mock_delivery', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (17, 'one_time_communication_release_approvals', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (18, 'scheduled_reminder_preview_runs', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (19, 'speaker_professional_profile_fields', CURRENT_TIMESTAMP);
