ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'assigned';

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (3, 'review_submission_status', CURRENT_TIMESTAMP);
