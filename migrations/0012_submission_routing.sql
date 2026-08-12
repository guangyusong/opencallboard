ALTER TABLE submissions ADD COLUMN review_route TEXT;
ALTER TABLE submissions ADD COLUMN routing_rule_id TEXT;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (12, 'server_authoritative_submission_routing', CURRENT_TIMESTAMP);
