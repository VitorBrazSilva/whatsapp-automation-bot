CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  nickname TEXT,
  birth_date TEXT NOT NULL CHECK (birth_date GLOB '????-??-??'),
  relationship TEXT,
  profession TEXT,
  hobbies TEXT,
  traits TEXT,
  message_style TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_people_active_birth_month_day
  ON people (active, substr(birth_date, 6, 2), substr(birth_date, 9, 2));

CREATE TABLE IF NOT EXISTS birthday_checks (
  id TEXT PRIMARY KEY,
  check_date TEXT NOT NULL CHECK (check_date GLOB '????-??-??'),
  timezone TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'startup', 'whatsapp-reconnect', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  birthdays_found INTEGER NOT NULL DEFAULT 0 CHECK (birthdays_found >= 0),
  deliveries_sent INTEGER NOT NULL DEFAULT 0 CHECK (deliveries_sent >= 0),
  duplicate_skips INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_skips >= 0),
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_birthday_checks_check_date
  ON birthday_checks (check_date);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  birthday_year INTEGER NOT NULL CHECK (birthday_year >= 1900),
  check_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE RESTRICT,
  FOREIGN KEY (check_id) REFERENCES birthday_checks(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_lookup
  ON delivery_attempts (person_id, group_id, birthday_year);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_check_id
  ON delivery_attempts (check_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_attempts_unique_sent
  ON delivery_attempts (person_id, group_id, birthday_year)
  WHERE status = 'sent';
