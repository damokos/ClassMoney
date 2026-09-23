import type {
  Class,
  CreateClassInput,
  UpdateClassInput,
} from "../../domain/classes/types";

interface ClassRow {
  id: number;
  code: string;
  display_name: string;
  currency: string;
  currency_decimals: number;
  balance: number;
  timezone: string;
  active: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapClass(row: ClassRow): Class {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    currency: row.currency,
    currencyDecimals: row.currency_decimals,
    balance: row.balance,
    timezone: row.timezone,
    active: row.active === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CLASS_COLUMNS = `
  id,
  code,
  display_name,
  currency,
  currency_decimals,
  balance,
  timezone,
  active,
  archived_at,
  created_at,
  updated_at
`;

export async function listClasses(
  db: D1Database,
  includeArchived = false,
): Promise<Class[]> {
  const query = includeArchived
    ? `
      SELECT ${CLASS_COLUMNS}
      FROM classes
      ORDER BY display_name COLLATE NOCASE, id
    `
    : `
      SELECT ${CLASS_COLUMNS}
      FROM classes
      WHERE active = 1
      ORDER BY display_name COLLATE NOCASE, id
    `;

  const result = await db.prepare(query).all<ClassRow>();

  return result.results.map(mapClass);
}

export async function listClassesForUser(
  db: D1Database,
  userId: number,
): Promise<Class[]> {
  const result = await db
    .prepare(`
      SELECT DISTINCT
        classes.id,
        classes.code,
        classes.display_name,
        classes.currency,
        classes.currency_decimals,
        classes.balance,
        classes.timezone,
        classes.active,
        classes.archived_at,
        classes.created_at,
        classes.updated_at
      FROM classes
      INNER JOIN user_roles
        ON user_roles.class_id = classes.id
      WHERE user_roles.user_id = ?
        AND user_roles.role IN (
          'PARENT_REPRESENTATIVE',
          'TREASURER'
        )
        AND classes.active = 1
      ORDER BY classes.display_name COLLATE NOCASE, classes.id
    `)
    .bind(userId)
    .all<ClassRow>();

  return result.results.map(mapClass);
}

export async function getClassById(
  db: D1Database,
  id: number,
): Promise<Class | null> {
  const row = await db
    .prepare(`
      SELECT ${CLASS_COLUMNS}
      FROM classes
      WHERE id = ?
    `)
    .bind(id)
    .first<ClassRow>();

  return row ? mapClass(row) : null;
}

export async function createClass(
  db: D1Database,
  input: CreateClassInput,
): Promise<Class> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(`
      INSERT INTO classes (
        code,
        display_name,
        currency,
        currency_decimals,
        timezone,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(
      input.code,
      input.displayName,
      input.currency,
      input.currencyDecimals,
      input.timezone,
      now,
      now,
    )
    .first<ClassRow>();

  if (!result) {
    throw new Error("Failed to create class");
  }

  return mapClass(result);
}

export async function updateClass(
  db: D1Database,
  id: number,
  input: UpdateClassInput,
): Promise<Class | null> {
  const current = await getClassById(db, id);

  if (!current) {
    return null;
  }

  const updatedAt = new Date().toISOString();

  const displayName = input.displayName ?? current.displayName;
  const currency = input.currency ?? current.currency;
  const currencyDecimals =
    input.currencyDecimals ?? current.currencyDecimals;
  const timezone = input.timezone ?? current.timezone;

  const result = await db
    .prepare(`
      UPDATE classes
      SET
        display_name = ?,
        currency = ?,
        currency_decimals = ?,
        timezone = ?,
        updated_at = ?
      WHERE id = ?
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(
      displayName,
      currency,
      currencyDecimals,
      timezone,
      updatedAt,
      id,
    )
    .first<ClassRow>();

  return result ? mapClass(result) : null;
}

export async function archiveClass(
  db: D1Database,
  id: number,
): Promise<Class | null> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(`
      UPDATE classes
      SET
        active = 0,
        archived_at = ?,
        updated_at = ?
      WHERE id = ?
        AND active = 1
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(now, now, id)
    .first<ClassRow>();

  return result ? mapClass(result) : null;
}
