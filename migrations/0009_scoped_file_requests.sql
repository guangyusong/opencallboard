ALTER TABLE file_requests ADD COLUMN assignee_person_id TEXT REFERENCES people(id) ON DELETE CASCADE;
ALTER TABLE file_requests ADD COLUMN submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE file_requests ADD COLUMN due_at TEXT;
ALTER TABLE file_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'open';

CREATE INDEX IF NOT EXISTS idx_file_requests_assignee ON file_requests(event_id, assignee_person_id, status);
CREATE INDEX IF NOT EXISTS idx_file_requests_submission ON file_requests(event_id, submission_id, status);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (9, 'scoped_file_requests', CURRENT_TIMESTAMP);
