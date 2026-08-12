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

CREATE INDEX IF NOT EXISTS idx_communication_templates_event ON communication_templates(event_id, category);
CREATE INDEX IF NOT EXISTS idx_communication_reminders_event ON communication_reminders(event_id, enabled);
CREATE INDEX IF NOT EXISTS idx_communication_previews_event ON communication_previews(event_id, created_at);

INSERT OR IGNORE INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at)
SELECT 'communication_reminder_profile_' || id, id, 'Incomplete speaker profile', 'general-reminder', 'all-speakers', 7, 'days before event', '7 days before event', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM events;

INSERT OR IGNORE INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at)
SELECT 'communication_reminder_task_' || id, id, 'Outstanding task deadline', 'task-due', 'incomplete-tasks', 3, 'days before task due', '3 days before task due', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM events;

INSERT OR IGNORE INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at)
SELECT 'communication_reminder_session_' || id, id, 'Upcoming session', 'session-scheduled', 'accepted-speakers', 24, 'hours before session', '24 hours before session', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM events;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (6, 'preview_only_communications', CURRENT_TIMESTAMP);
