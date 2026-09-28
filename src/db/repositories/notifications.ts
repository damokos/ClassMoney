export interface NotificationType {
  code: string;
  name: string;
  description: string | null;
  roles: string[];
}

export interface NotificationSettings {
  emailEnabled: boolean;
  digestTime: string;
  timezone: string;
  preferences: Record<string, boolean>;
}

export async function listNotificationTypes(db: D1Database): Promise<NotificationType[]> {
  const rows = await db.prepare(`
    SELECT t.id, t.code, t.name, t.description, r.role
    FROM notification_types t
    LEFT JOIN notification_type_roles r ON r.notification_type_id = t.id
    WHERE t.active = 1
    ORDER BY t.id, r.role
  `).all<{ id: number; code: string; name: string; description: string | null; role: string | null }>();
  const types = new Map<string, NotificationType>();
  for (const row of rows.results) {
    const item = types.get(row.code) ?? { code: row.code, name: row.name, description: row.description, roles: [] };
    if (row.role) item.roles.push(row.role);
    types.set(row.code, item);
  }
  return [...types.values()];
}

export async function getNotificationSettings(db: D1Database, userId: number): Promise<NotificationSettings> {
  const [settings, types, prefs] = await Promise.all([
    db.prepare("SELECT email_enabled, digest_time, timezone FROM notification_settings WHERE user_id = ?").bind(userId).first<{ email_enabled: number; digest_time: string; timezone: string }>(),
    listNotificationTypes(db),
    db.prepare("SELECT t.code, p.enabled FROM notification_preferences p INNER JOIN notification_types t ON t.id = p.notification_type_id WHERE p.user_id = ?").bind(userId).all<{ code: string; enabled: number }>(),
  ]);
  const enabled = new Map(prefs.results.map((row) => [row.code, row.enabled === 1]));
  return {
    emailEnabled: settings ? settings.email_enabled === 1 : true,
    digestTime: settings?.digest_time ?? "08:00",
    timezone: settings?.timezone ?? "Europe/Budapest",
    preferences: Object.fromEntries(types.map((type) => [type.code, enabled.get(type.code) ?? true])),
  };
}

export async function saveNotificationSettings(
  db: D1Database,
  userId: number,
  settings: NotificationSettings,
): Promise<void> {
  const now = new Date().toISOString();
  const statements = [db.prepare(`
    INSERT INTO notification_settings (user_id, email_enabled, digest_time, timezone, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET email_enabled = excluded.email_enabled,
      digest_time = excluded.digest_time, timezone = excluded.timezone, updated_at = excluded.updated_at
  `).bind(userId, settings.emailEnabled ? 1 : 0, settings.digestTime, settings.timezone, now)];
  for (const [code, enabled] of Object.entries(settings.preferences)) {
    statements.push(db.prepare(`
      INSERT INTO notification_preferences (user_id, notification_type_id, enabled, created_at, updated_at)
      SELECT ?, id, ?, ?, ? FROM notification_types WHERE code = ? AND active = 1
      ON CONFLICT(user_id, notification_type_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
    `).bind(userId, enabled ? 1 : 0, now, now, code));
  }
  await db.batch(statements);
}

export async function createNotificationEvents(
  db: D1Database,
  code: string,
  classId: number,
  entityType: string,
  entityId: number,
  payload: Record<string, unknown>,
  childId?: number,
): Promise<void> {
  const recipients = await db.prepare(`
    SELECT DISTINCT u.id AS user_id, t.id AS type_id
    FROM notification_types t
    INNER JOIN users u ON u.active = 1
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.class_id = ?
    LEFT JOIN notification_type_roles tr ON tr.notification_type_id = t.id AND tr.role = ur.role
    LEFT JOIN user_children uc ON uc.user_id = u.id AND uc.child_id = ?
    WHERE t.code = ? AND t.active = 1
      AND (tr.role IS NOT NULL OR (t.code IN ('CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD', 'CHARGE_DUE_SOON') AND uc.user_id IS NOT NULL))
  `).bind(classId, childId ?? -1, code).all<{ user_id: number; type_id: number }>();
  if (!recipients.results.length) return;
  const encodedPayload = JSON.stringify(payload);
  const createdAt = new Date().toISOString();
  await db.batch(recipients.results.map((recipient) => db.prepare(`
    INSERT OR IGNORE INTO notification_events (notification_type_id, user_id, class_id, entity_type, entity_id, payload, status, created_at)
    SELECT ?, ?, ?, ?, ?, ?, 'PENDING', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM notification_events
      WHERE notification_type_id = ? AND user_id = ? AND entity_type = ? AND entity_id = ?
    )
  `).bind(recipient.type_id, recipient.user_id, classId, entityType, entityId, encodedPayload, createdAt,
    recipient.type_id, recipient.user_id, entityType, entityId)));
}

export async function createUserCreatedNotificationEvents(
  db: D1Database,
  user: { id: number; email: string; createdAt: string },
): Promise<void> {
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({
    userId: user.id,
    email: user.email,
    createdAt: user.createdAt,
  });
  await db.prepare(`
    INSERT OR IGNORE INTO notification_events (
      notification_type_id, user_id, class_id, entity_type, entity_id,
      payload, status, created_at
    )
    SELECT t.id, admin.id, NULL, 'user_created', ?, ?, 'PENDING', ?
    FROM notification_types t
    INNER JOIN notification_type_roles tr
      ON tr.notification_type_id = t.id AND tr.role = 'ADMIN'
    INNER JOIN user_roles ur
      ON ur.role = 'ADMIN' AND ur.class_id IS NULL
    INNER JOIN users admin ON admin.id = ur.user_id AND admin.active = 1
    WHERE t.code = 'USER_CREATED' AND t.active = 1
      AND NOT EXISTS (
        SELECT 1 FROM notification_events e
        WHERE e.notification_type_id = t.id
          AND e.user_id = admin.id
          AND e.entity_type = 'user_created'
          AND e.entity_id = ?
      )
  `).bind(user.id, payload, createdAt, user.id).run();
}

export async function listNotifications(db: D1Database, userId: number): Promise<Array<Record<string, unknown>>> {
  const rows = await db.prepare(`
    SELECT e.id, t.code, e.class_id AS classId, e.entity_type AS entityType,
      e.entity_id AS entityId, e.payload, e.status, e.created_at AS createdAt,
      e.sent_at AS sentAt, e.read_at AS readAt
    FROM notification_events e
    INNER JOIN notification_types t ON t.id = e.notification_type_id
    WHERE e.user_id = ?
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 200
  `).bind(userId).all<{ id: number; code: string; classId: number | null; entityType: string | null; entityId: number | null; payload: string | null; status: string; createdAt: string; sentAt: string | null; readAt: string | null }>();
  return rows.results.map((row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : null }));
}
