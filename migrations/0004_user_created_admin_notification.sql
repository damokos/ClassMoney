INSERT INTO notification_types (code, name, description, active, created_at, created_by)
VALUES (
    'USER_CREATED',
    'New user signed in',
    'A user account was created on first sign-in and needs child assignments.',
    1,
    '1970-01-01T00:00:00Z',
    NULL
)
ON CONFLICT(code) DO NOTHING;

INSERT OR IGNORE INTO notification_type_roles (notification_type_id, role)
SELECT id, 'ADMIN'
FROM notification_types
WHERE code = 'USER_CREATED';
