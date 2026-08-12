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

ALTER TABLE reviews ADD COLUMN round_id TEXT;

INSERT OR IGNORE INTO evaluation_rounds (id, event_id, name, number, status, blind, criteria_json, version, created_at, updated_at)
SELECT
  'evaluation_round_1_' || id,
  id,
  'Round 1 · Technical review',
  1,
  'open',
  1,
  '[{"id":"relevance","label":"Program relevance","weight":30},{"id":"originality","label":"Originality","weight":20},{"id":"technical","label":"Technical depth","weight":30},{"id":"practical","label":"Practical value","weight":20}]',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM events;

INSERT OR IGNORE INTO evaluation_rounds (id, event_id, name, number, status, blind, criteria_json, version, created_at, updated_at)
SELECT
  'evaluation_round_' || round || '_' || event_id,
  event_id,
  'Round ' || round || ' · Review',
  round,
  CASE WHEN round = 1 THEN 'open' ELSE 'upcoming' END,
  CASE WHEN round = 1 THEN 1 ELSE 0 END,
  '[{"id":"relevance","label":"Program relevance","weight":30},{"id":"originality","label":"Originality","weight":20},{"id":"technical","label":"Technical depth","weight":30},{"id":"practical","label":"Practical value","weight":20}]',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT event_id, round FROM reviews);

UPDATE reviews
SET round_id = 'evaluation_round_' || round || '_' || event_id
WHERE round_id IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_event ON evaluation_rounds(event_id, number);
CREATE INDEX IF NOT EXISTS idx_reviews_round ON reviews(event_id, round_id, submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_decisions_round ON evaluation_decisions(event_id, round_id, submission_id);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (8, 'shared_evaluation_rounds', CURRENT_TIMESTAMP);
