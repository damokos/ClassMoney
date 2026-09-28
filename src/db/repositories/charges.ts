import type {
  Charge,
  ChargeStatus,
  CreateChargeInput,
} from "../../domain/charges/types";

interface ChargeRow {
  id: number;
  class_id: number;
  child_id: number;
  title: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  paid_at: string | null;
  paid_by: number | null;
  cancelled_at: string | null;
  cancelled_by: number | null;
  batch_id: number | null;
  created_at: string;
  created_by: number;
}

function mapCharge(row: ChargeRow): Charge {
  return {
    id: row.id,
    classId: row.class_id,
    childId: row.child_id,
    title: row.title,
    amount: row.amount,
    dueDate: row.due_date,
    status: row.status,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    batchId: row.batch_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

const CHARGE_COLUMNS = `
  id,
  class_id,
  child_id,
  title,
  amount,
  due_date,
  status,
  paid_at,
  paid_by,
  cancelled_at,
  cancelled_by,
  batch_id,
  created_at,
  created_by
`;

export async function getChargeById(
  db: D1Database,
  id: number,
): Promise<Charge | null> {
  const row = await db
    .prepare(`
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE id = ?
    `)
    .bind(id)
    .first<ChargeRow>();

  return row ? mapCharge(row) : null;
}

export async function getChargeByIdForClass(
  db: D1Database,
  classId: number,
  id: number,
): Promise<Charge | null> {
  const row = await db
    .prepare(`
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE class_id = ?
        AND id = ?
    `)
    .bind(classId, id)
    .first<ChargeRow>();

  return row ? mapCharge(row) : null;
}

export async function listChargesForClass(
  db: D1Database,
  classId: number,
  includeCancelled = false,
): Promise<Charge[]> {
  const query = includeCancelled
    ? `
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE class_id = ?
      ORDER BY due_date, id
    `
    : `
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE class_id = ?
        AND status != 'CANCELLED'
      ORDER BY due_date, id
    `;

  const result = await db
    .prepare(query)
    .bind(classId)
    .all<ChargeRow>();

  return result.results.map(mapCharge);
}

export async function listChargesForChild(
  db: D1Database,
  classId: number,
  childId: number,
  includeCancelled = false,
): Promise<Charge[]> {
  const query = includeCancelled
    ? `
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE class_id = ?
        AND child_id = ?
      ORDER BY due_date, id
    `
    : `
      SELECT ${CHARGE_COLUMNS}
      FROM charges
      WHERE class_id = ?
        AND child_id = ?
        AND status != 'CANCELLED'
      ORDER BY due_date, id
    `;

  const result = await db
    .prepare(query)
    .bind(classId, childId)
    .all<ChargeRow>();

  return result.results.map(mapCharge);
}

export async function listChargesForUser(
  db: D1Database,
  userId: number,
  includeCancelled = false,
): Promise<Charge[]> {
  const userChargeColumns = `
    charges.id,
    charges.class_id,
    charges.child_id,
    charges.title,
    charges.amount,
    charges.due_date,
    charges.status,
    charges.paid_at,
    charges.paid_by,
    charges.cancelled_at,
    charges.cancelled_by,
    charges.batch_id,
    charges.created_at,
    charges.created_by
  `;

  const query = includeCancelled
    ? `
      SELECT ${userChargeColumns}
      FROM charges
      INNER JOIN user_children
        ON user_children.child_id = charges.child_id
      INNER JOIN children
        ON children.id = charges.child_id
       AND children.class_id = charges.class_id
      WHERE user_children.user_id = ?
        AND children.active = 1
      ORDER BY charges.due_date, charges.id
    `
    : `
      SELECT ${userChargeColumns}
      FROM charges
      INNER JOIN user_children
        ON user_children.child_id = charges.child_id
      INNER JOIN children
        ON children.id = charges.child_id
       AND children.class_id = charges.class_id
      WHERE user_children.user_id = ?
        AND children.active = 1
        AND charges.status != 'CANCELLED'
      ORDER BY charges.due_date, charges.id
    `;

  const result = await db
    .prepare(query)
    .bind(userId)
    .all<ChargeRow>();

  return result.results.map(mapCharge);
}

export async function createCharge(
  db: D1Database,
  input: CreateChargeInput,
  createdBy: number,
): Promise<Charge> {
  const now = new Date().toISOString();

  const row = await db
    .prepare(`
      INSERT INTO charges (
        class_id,
        child_id,
        title,
        amount,
        due_date,
        status,
        batch_id,
        created_at,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
      RETURNING ${CHARGE_COLUMNS}
    `)
    .bind(
      input.classId,
      input.childId,
      input.title,
      input.amount,
      input.dueDate,
      input.batchId ?? null,
      now,
      createdBy,
    )
    .first<ChargeRow>();

  if (!row) {
    throw new Error("Failed to create charge");
  }

  return mapCharge(row);
}
