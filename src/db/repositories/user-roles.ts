import type { Role, UserRole } from "../../auth/types";

interface UserRoleRow {
  id: number;
  user_id: number;
  role: Role;
  class_id: number | null;
  created_at: string;
  created_by: number | null;
}

export async function getUserRoles(
  db: D1Database,
  userId: number,
): Promise<UserRole[]> {
  const result = await db
    .prepare(`
      SELECT
        role,
        class_id
      FROM user_roles
      WHERE user_id = ?
      ORDER BY id
    `)
    .bind(userId)
    .all<UserRoleRow>();

  return result.results.map((row) => ({
    role: row.role,
    classId: row.class_id,
  }));
}

export async function addUserRole(
  db: D1Database,
  userId: number,
  role: Role,
  classId: number | null,
  createdBy: number,
): Promise<UserRole> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(`
      INSERT INTO user_roles (
        user_id,
        class_id,
        role,
        created_at,
        created_by
      )
      VALUES (?, ?, ?, ?, ?)
      RETURNING
        id,
        user_id,
        role,
        class_id,
        created_at,
        created_by
    `)
    .bind(
      userId,
      classId,
      role,
      now,
      createdBy,
    )
    .first<UserRoleRow>();

  if (!result) {
    throw new Error("Failed to add user role");
  }

  return {
    role: result.role,
    classId: result.class_id,
  };
}

export async function removeUserRole(
  db: D1Database,
  userId: number,
  role: Role,
  classId: number | null,
): Promise<boolean> {
  const result = await db
    .prepare(`
      DELETE FROM user_roles
      WHERE user_id = ?
        AND role = ?
        AND (
          class_id = ?
          OR (class_id IS NULL AND ? IS NULL)
        )
    `)
    .bind(
      userId,
      role,
      classId,
      classId,
    )
    .run();

  return result.meta.changes > 0;
}
