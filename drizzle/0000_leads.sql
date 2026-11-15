CREATE TABLE leads (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, reply_channel TEXT NOT NULL, project_type TEXT NOT NULL, brief TEXT NOT NULL);
CREATE TABLE notifications (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id), channel TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, provider_id TEXT, last_error TEXT, next_attempt_at TEXT, updated_at TEXT NOT NULL);
CREATE INDEX notifications_pending ON notifications(status, next_attempt_at);
