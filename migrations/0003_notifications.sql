CREATE TABLE notification_settings (
    user_id      INTEGER PRIMARY KEY,
    email_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_enabled IN (0, 1)),
    digest_time  TEXT NOT NULL DEFAULT '08:00',
    timezone     TEXT NOT NULL DEFAULT 'Europe/Budapest',
    updated_at   TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (digest_time GLOB '[0-2][0-9]:[0-5][0-9]')
);

ALTER TABLE notification_events ADD COLUMN read_at TEXT;

CREATE INDEX idx_notification_events_inbox
    ON notification_events(user_id, read_at, created_at);

CREATE UNIQUE INDEX uq_notification_event_recipient
    ON notification_events(notification_type_id, user_id, entity_type, entity_id)
    WHERE user_id IS NOT NULL AND entity_type IS NOT NULL AND entity_id IS NOT NULL;
