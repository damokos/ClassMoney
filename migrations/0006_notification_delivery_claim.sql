ALTER TABLE notification_events ADD COLUMN delivery_claimed_at TEXT;

CREATE INDEX idx_notification_events_delivery_claim
    ON notification_events(status, delivery_claimed_at, user_id);
