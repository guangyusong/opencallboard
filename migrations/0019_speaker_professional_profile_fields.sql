ALTER TABLE people ADD COLUMN title TEXT;
ALTER TABLE people ADD COLUMN company TEXT;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (19, 'speaker_professional_profile_fields', CURRENT_TIMESTAMP);
