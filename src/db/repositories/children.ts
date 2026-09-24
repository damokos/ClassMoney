import type {
  Child,
  CreateChildInput,
  UpdateChildInput,
} from "../../domain/children/types";

interface ChildRow {
  id: number;
  class_id: number;
  name: string;
  active: number;
  created_at: string;
  updated_at: string;
}

function mapChild(row: ChildRow): Child {
  return {
    id: row.id,
    classId: row.class_id,
    name: row.name,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CHILD_COLUMNS = `
  id,
  class_id,
  name,
  active,
  created_at,
  updated_at
`;

export async function listChildren(
  db: D1Database,
  classId: number,
  includeInactive = false,
): Promise<Child[]> {
  const query = includeInactive
    ? `
      SELECT ${CHILD_COLUMNS}
      FROM children
      WHERE class_id = ?
      ORDER BY name COLLATE NOCASE, id
    `
    : `
      SELECT ${CHILD_COLUMNS}
      FROM children
      WHERE class_id = ?
        AND active = 1
      ORDER BY name COLLATE NOCASE, id
    `;

  const result = await db
    .prepare(query)
    .bind(classId)
    .all<ChildRow>();

  return result.results.map(mapChild);
}

export async function getChildById(
  db: D1Database,
  classId: number,
  id: number,
): Promise<Child | null> {
  const row = await db
    .prepare(`
      SELECT ${CHILD_COLUMNS}
      FROM children
      WHERE class_id = ?
        AND id = ?
    `)
    .bind(classId, id)
    .first<ChildRow>();

  return row ? mapChild(row) : null;
}

export async function createChild(
  db: D1Database,
  input: CreateChildInput,
): Promise<Child> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(`
      INSERT INTO children (
        class_id,
        name,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
      RETURNING ${CHILD_COLUMNS}
    `)
    .bind(
      input.classId,
      input.name,
      now,
      now,
    )
    .first<ChildRow>();

  if (!result) {
    throw new Error("Failed to create child");
  }

  return mapChild(result);
}

export async function updateChild(
  db: D1Database,
  classId: number,
  id: number,
  input: UpdateChildInput,
): Promise<Child | null> {
  const current = await getChildById(db, classId, id);

  if (!current) {
    return null;
  }

  const updatedAt = new Date().toISOString();
  const name = input.name ?? current.name;
  const active = input.active ?? current.active;

  const result = await db
    .prepare(`
      UPDATE children
      SET
        name = ?,
        active = ?,
        updated_at = ?
      WHERE class_id = ?
        AND id = ?
      RETURNING ${CHILD_COLUMNS}
    `)
    .bind(
      name,
      active ? 1 : 0,
      updatedAt,
      classId,
      id,
    )
    .first<ChildRow>();

  return result ? mapChild(result) : null;
}
