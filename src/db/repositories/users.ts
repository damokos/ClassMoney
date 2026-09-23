import type { User } from "../../domain/users/types";

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

export async function getOrCreateUserByEmail(
  db: D1Database,
  email: string,
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO users (
        email,
        active,
        created_at,
        updated_at
      )
      VALUES (?, 1, ?, ?)
      ON CONFLICT(email) DO NOTHING
    `)
    .bind(normalizedEmail, now, now)
    .run();

  const user = await getUserByEmail(db, normalizedEmail);

  if (!user) {
    throw new Error("Failed to create or load user");
  }

  return user;
}
