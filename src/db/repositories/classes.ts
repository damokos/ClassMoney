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
  bank_account_number: string | null;
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
    bankAccountNumber: row.bank_account_number,
    active: row.active === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CLASS_COLUMNS = `
  classes.id,
  classes.code,
  classes.display_name,
  classes.currency,
  classes.currency_decimals,
  classes.balance,
  classes.timezone,
  classes.bank_account_number,
  classes.active,
  classes.archived_at,
  classes.created_at,
  classes.updated_at
`;

export async function listClasses(
  db: D1Database,
  includeArchived = false,
): Promise<Class[]> {
  const query = includeArchived
    ? `
      SELECT ${CLASS_COLUMNS}
      FROM classes
      ORDER BY code COLLATE NOCASE, id
    `
    : `
      SELECT ${CLASS_COLUMNS}
      FROM classes
      WHERE active = 1
      ORDER BY code COLLATE NOCASE, id
    `;

  const result = await db
    .prepare(query)
    .all<ClassRow>();

  return result.results.map(mapClass);
}

export async function listClassesForUser(
  db: D1Database,
  userId: number,
): Promise<Class[]> {
  const result = await db
    .prepare(`
      SELECT DISTINCT ${CLASS_COLUMNS}
      FROM classes
      INNER JOIN user_roles
        ON user_roles.class_id = classes.id
      WHERE classes.active = 1
        AND user_roles.user_id = ?
        AND user_roles.role IN (
          'PARENT_REPRESENTATIVE',
          'TREASURER'
        )
      ORDER BY classes.code COLLATE NOCASE, classes.id
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

  const row = await db
    .prepare(`
      INSERT INTO classes (
        code,
        display_name,
        currency,
        currency_decimals,
        timezone,
        bank_account_number,
        active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(
      input.code,
      input.displayName,
      input.currency,
      input.currencyDecimals,
      input.timezone,
      input.bankAccountNumber ?? null,
      now,
      now,
    )
    .first<ClassRow>();

  if (!row) {
    throw new Error("Failed to create class");
  }

  return mapClass(row);
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

  const displayName =
    input.displayName ?? current.displayName;
  const currency =
    input.currency ?? current.currency;
  const currencyDecimals =
    input.currencyDecimals ?? current.currencyDecimals;
  const timezone =
    input.timezone ?? current.timezone;
  const bankAccountNumber =
    input.bankAccountNumber !== undefined
      ? input.bankAccountNumber
      : current.bankAccountNumber;

  const row = await db
    .prepare(`
      UPDATE classes
      SET
        display_name = ?,
        currency = ?,
        currency_decimals = ?,
        timezone = ?,
        bank_account_number = ?,
        updated_at = ?
      WHERE id = ?
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(
      displayName,
      currency,
      currencyDecimals,
      timezone,
      bankAccountNumber,
      updatedAt,
      id,
    )
    .first<ClassRow>();

  return row ? mapClass(row) : null;
}

export async function archiveClass(
  db: D1Database,
  id: number,
): Promise<Class | null> {
  const current = await getClassById(db, id);

  if (!current) {
    return null;
  }

  if (!current.active) {
    return current;
  }

  const archivedAt = new Date().toISOString();

  const row = await db
    .prepare(`
      UPDATE classes
      SET
        active = 0,
        archived_at = ?,
        updated_at = ?
      WHERE id = ?
      RETURNING ${CLASS_COLUMNS}
    `)
    .bind(
      archivedAt,
      archivedAt,
      id,
    )
    .first<ClassRow>();

  return row ? mapClass(row) : null;
}
