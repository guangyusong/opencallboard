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

CREATE INDEX IF NOT EXISTS idx_cfp_drafts_submitter
ON cfp_drafts(event_id, form_id, submitter_email, submitted_at, expires_at);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (10, 'public_cfp_drafts', CURRENT_TIMESTAMP);
