import type { Role, UserRole } from "../../auth/types";

interface UserRoleRow {
  role: Role;
  class_id: number | null;
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
