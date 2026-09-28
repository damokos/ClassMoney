import type { User } from "../../domain/users/types";
import type { UserRole } from "../../auth/types";
import { getUserRoles } from "./user-roles";

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

export async function listUsers(
  db: D1Database,
  includeInactive = false,
): Promise<Array<User & { roles: UserRole[] }>> {
  const query = includeInactive
    ? `
      SELECT ${USER_COLUMNS}
      FROM users
      ORDER BY email COLLATE NOCASE, id
    `
    : `
      SELECT ${USER_COLUMNS}
      FROM users
      WHERE active = 1
      ORDER BY email COLLATE NOCASE, id
    `;

  const result = await db
    .prepare(query)
    .all<UserRow>();

  return Promise.all(result.results.map(async (row) => ({
    ...mapUser(row),
    roles: await getUserRoles(db, row.id),
  })));
}

export async function listAdminUsers(
  db: D1Database,
  includeInactive = true,
): Promise<Array<User & { roles: UserRole[]; children: Array<{ id: number; name: string; classId: number; className: string }> }>> {
  const users = await listUsers(db, includeInactive);
  return Promise.all(users.map(async (user) => {
    const children = await db.prepare(`
      SELECT children.id, children.name, children.class_id AS classId,
        classes.display_name AS className
      FROM user_children
      INNER JOIN children ON children.id = user_children.child_id
      INNER JOIN classes ON classes.id = children.class_id
      WHERE user_children.user_id = ?
      ORDER BY classes.display_name COLLATE NOCASE, children.name COLLATE NOCASE
    `).bind(user.id).all<{ id: number; name: string; classId: number; className: string }>();
    return { ...user, children: children.results };
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
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await getUserByEmail(
    db,
    normalizedEmail,
  );

  if (existingUser) {
    return existingUser;
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

  return user;
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

  const roles = await db
    .prepare(`
      SELECT
        role,
        class_id
      FROM user_roles
      WHERE user_id = ?
    `)
    .bind(id)
    .all<{
      role: string;
      class_id: number | null;
    }>();

  const classRoles = roles.results.filter(
    (role) => role.class_id !== null,
  );

  for (const role of classRoles) {
    if (
      role.role !== "TREASURER" &&
      role.role !== "PARENT_REPRESENTATIVE"
    ) {
      continue;
    }

    const result = await db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM user_roles
        WHERE class_id = ?
          AND role = ?
          AND user_id != ?
      `)
      .bind(
        role.class_id,
        role.role,
        id,
      )
      .first<{ count: number }>();

    if ((result?.count ?? 0) === 0) {
      throw new Error(
        `Cannot deactivate the last ${role.role} for class ${role.class_id}`,
      );
    }
  }

  const now = new Date().toISOString();

  await db
    .prepare(`
      DELETE FROM user_roles
      WHERE user_id = ?
    `)
    .bind(id)
    .run();

  const result = await db
    .prepare(`
      UPDATE users
      SET
        active = 0,
        updated_at = ?
      WHERE id = ?
      RETURNING ${USER_COLUMNS}
    `)
    .bind(now, id)
    .first<UserRow>();

  return result ? mapUser(result) : null;
}
