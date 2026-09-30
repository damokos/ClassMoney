import type { User } from "../../domain/users/types";
import type { UserRole } from "../../auth/types";

interface UserRow {
  id: number;
  email: string;
  active: number;
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_COLUMNS = `
  id,
  email,
  active,
  created_at,
  updated_at
`;

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  const row = await db
    .prepare(`
      SELECT ${USER_COLUMNS}
      FROM users
      WHERE lower(email) = lower(?)
    `)
    .bind(email)
    .first<UserRow>();

  return row ? mapUser(row) : null;
}

export async function getUserById(
  db: D1Database,
  id: number,
): Promise<User | null> {
  const row = await db
    .prepare(`
      SELECT ${USER_COLUMNS}
      FROM users
      WHERE id = ?
    `)
    .bind(id)
    .first<UserRow>();

  return row ? mapUser(row) : null;
}

export async function createUserByEmail(
  db: D1Database,
  email: string,
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const row = await db.prepare(`
    INSERT INTO users (email, active, created_at, updated_at)
    VALUES (?, 1, ?, ?)
    RETURNING ${USER_COLUMNS}
  `).bind(normalizedEmail, now, now).first<UserRow>();

  if (!row) {
    throw new Error("Failed to create user");
  }

  return mapUser(row);
}

export async function listUsers(
  db: D1Database,
  includeInactive = false,
): Promise<Array<User & { roles: UserRole[] }>> {
  return (await listAdminUsers(db, includeInactive)).map(({ children: _children, ...user }) => user);
}

export async function listAdminUsers(
  db: D1Database,
  includeInactive = true,
): Promise<Array<User & { roles: UserRole[]; children: Array<{ id: number; name: string; classId: number; className: string }> }>> {
  const usersResult = await db.prepare(includeInactive
    ? `SELECT ${USER_COLUMNS} FROM users ORDER BY email COLLATE NOCASE, id`
    : `SELECT ${USER_COLUMNS} FROM users WHERE active = 1 ORDER BY email COLLATE NOCASE, id`
  ).all<UserRow>();
  if (!usersResult.results.length) return [];
  const [rolesResult, childrenResult] = await Promise.all([
    db.prepare(`SELECT user_roles.user_id, role, class_id FROM user_roles INNER JOIN users ON users.id = user_roles.user_id ${includeInactive ? "" : "WHERE users.active = 1"} ORDER BY role, class_id`)
      .all<{ user_id: number; role: UserRole["role"]; class_id: number | null }>(),
    db.prepare(`
      SELECT children.id, children.name, children.class_id AS classId,
        classes.display_name AS className, user_children.user_id AS userId
      FROM user_children
      INNER JOIN users ON users.id = user_children.user_id
      INNER JOIN children ON children.id = user_children.child_id
      INNER JOIN classes ON classes.id = children.class_id
      WHERE 1 = 1 ${includeInactive ? "" : "AND users.active = 1"}
      ORDER BY classes.display_name COLLATE NOCASE, children.name COLLATE NOCASE
    `).all<{ id: number; name: string; classId: number; className: string; userId: number }>(),
  ]);
  const rolesByUser = new Map<number, UserRole[]>();
  const childrenByUser = new Map<number, Array<{ id: number; name: string; classId: number; className: string }>>();
  for (const row of rolesResult.results) {
    const roles = rolesByUser.get(row.user_id) ?? [];
    roles.push({ role: row.role, classId: row.class_id });
    rolesByUser.set(row.user_id, roles);
  }
  for (const { userId, ...child } of childrenResult.results) {
    const children = childrenByUser.get(userId) ?? [];
    children.push(child);
    childrenByUser.set(userId, children);
  }
  return usersResult.results.map((row) => ({
    ...mapUser(row),
    roles: rolesByUser.get(row.id) ?? [],
    children: childrenByUser.get(row.id) ?? [],
  }));
}

export async function setUserChildren(
  db: D1Database,
  userId: number,
  childIds: number[],
): Promise<void> {
  const ids = [...new Set(childIds)];
  if (ids.length !== childIds.length) throw new Error("Duplicate child IDs");
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const found = await db.prepare(`SELECT id FROM children WHERE id IN (${placeholders})`).bind(...ids).all<{ id: number }>();
    if (found.results.length !== ids.length) throw new Error("One or more children are unavailable");
  }
  const statements = [db.prepare("DELETE FROM user_children WHERE user_id = ?").bind(userId), ...ids.map((childId) => db.prepare("INSERT INTO user_children (user_id, child_id) VALUES (?, ?)").bind(userId, childId))];
  await db.batch(statements);
}

export async function getOrCreateUserByEmail(
  db: D1Database,
  email: string,
): Promise<{ user: User; created: boolean; initialAdmin: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await getUserByEmail(
    db,
    normalizedEmail,
  );

  if (existingUser) {
    return { user: existingUser, created: false, initialAdmin: false };
  }

  const userCount = await db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM users
    `)
    .first<{ count: number }>();

  const isFirstUser = (userCount?.count ?? 0) === 0;
  const now = new Date().toISOString();

  const insertResult = await db
    .prepare(`
      INSERT INTO users (
        email,
        active,
        created_at,
        updated_at
      )
      VALUES (?, 1, ?, ?)
      ON CONFLICT(email) DO NOTHING
      RETURNING id
    `)
    .bind(
      normalizedEmail,
      now,
      now,
    )
    .first<{ id: number }>();

  const user = await getUserByEmail(
    db,
    normalizedEmail,
  );

  if (!user) {
    throw new Error("Failed to create or load user");
  }

  if (isFirstUser && insertResult) {
    await db
      .prepare(`
        INSERT INTO user_roles (
          user_id,
          class_id,
          role,
          created_at,
          created_by
        )
        VALUES (?, NULL, 'ADMIN', ?, NULL)
      `)
      .bind(
        insertResult.id,
        now,
      )
      .run();
  }

  return {
    user,
    created: Boolean(insertResult),
    initialAdmin: Boolean(insertResult && isFirstUser),
  };
}

export async function setUserActive(
  db: D1Database,
  id: number,
  active: boolean,
): Promise<User | null> {
  const updatedAt = new Date().toISOString();

  const result = await db
    .prepare(`
      UPDATE users
      SET
        active = ?,
        updated_at = ?
      WHERE id = ?
      RETURNING ${USER_COLUMNS}
    `)
    .bind(
      active ? 1 : 0,
      updatedAt,
      id,
    )
    .first<UserRow>();

  return result ? mapUser(result) : null;
}

export async function deactivateUser(
  db: D1Database,
  id: number,
): Promise<User | null> {
  const user = await getUserById(db, id);

  if (!user) {
    return null;
  }

  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(id),
    db.prepare(`
      UPDATE users
      SET
        active = 0,
        updated_at = ?
      WHERE id = ?
      RETURNING ${USER_COLUMNS}
    `).bind(now, id),
  ]);
  if (results[1].meta.changes !== 1) return null;
  return getUserById(db, id);
}
