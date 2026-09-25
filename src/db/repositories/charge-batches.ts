import type {
  ChargeBatch,
  CreateChargeBatchInput,
} from "../../domain/charges/types";

interface ChargeBatchRow {
  id: number;
  class_id: number;
  created_at: string;
  created_by: number;
}

function mapChargeBatch(
  row: ChargeBatchRow,
): ChargeBatch {
  return {
    id: row.id,
    classId: row.class_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

const CHARGE_BATCH_COLUMNS = `
  id,
  class_id,
  created_at,
  created_by
`;

export async function getChargeBatchById(
  db: D1Database,
  id: number,
): Promise<ChargeBatch | null> {
  const row = await db
    .prepare(`
      SELECT ${CHARGE_BATCH_COLUMNS}
      FROM charge_batches
      WHERE id = ?
    `)
    .bind(id)
    .first<ChargeBatchRow>();

  return row ? mapChargeBatch(row) : null;
}

export async function getChargeBatchByIdForClass(
  db: D1Database,
  classId: number,
  id: number,
): Promise<ChargeBatch | null> {
  const row = await db
    .prepare(`
      SELECT ${CHARGE_BATCH_COLUMNS}
      FROM charge_batches
      WHERE class_id = ?
        AND id = ?
    `)
    .bind(classId, id)
    .first<ChargeBatchRow>();

  return row ? mapChargeBatch(row) : null;
}

export async function listChargeBatchesForClass(
  db: D1Database,
  classId: number,
): Promise<ChargeBatch[]> {
  const result = await db
    .prepare(`
      SELECT ${CHARGE_BATCH_COLUMNS}
      FROM charge_batches
      WHERE class_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .bind(classId)
    .all<ChargeBatchRow>();

  return result.results.map(mapChargeBatch);
}

export async function createChargeBatch(
  db: D1Database,
  input: CreateChargeBatchInput,
  createdBy: number,
): Promise<ChargeBatch> {
  const now = new Date().toISOString();

  const row = await db
    .prepare(`
      INSERT INTO charge_batches (
        class_id,
        created_at,
        created_by
      )
      VALUES (?, ?, ?)
      RETURNING ${CHARGE_BATCH_COLUMNS}
    `)
    .bind(
      input.classId,
      now,
      createdBy,
    )
    .first<ChargeBatchRow>();

  if (!row) {
    throw new Error("Failed to create charge batch");
  }

  return mapChargeBatch(row);
}
