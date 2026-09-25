import type { Charge } from "../domain/charges/types";
import {
  getChargeById,
} from "../db/repositories/charges";
import {
  ConflictError,
  NotFoundError,
} from "../http/errors";

export async function payCharge(
  db: D1Database,
  chargeId: number,
  paidBy: number,
): Promise<Charge> {
  const charge = await getChargeById(db, chargeId);

  if (!charge) {
    throw new NotFoundError("Charge not found");
  }

  if (charge.status !== "PENDING") {
    throw new ConflictError(
      `Charge cannot be paid because its status is ${charge.status}`,
    );
  }

  const paidAt = new Date().toISOString();

  const chargeUpdate = db
    .prepare(`
      UPDATE charges
      SET
        status = 'PAID',
        paid_at = ?,
        paid_by = ?
      WHERE id = ?
        AND status = 'PENDING'
    `)
    .bind(
      paidAt,
      paidBy,
      chargeId,
    );

  const balanceTransaction = db
    .prepare(`
      INSERT INTO balance_transactions (
        class_id,
        amount,
        transaction_type,
        reference_type,
        reference_id,
        description,
        created_at,
        created_by
      )
      VALUES (
        ?,
        ?,
        'CHARGE_PAID',
        'charge',
        ?,
        ?,
        ?,
        ?
      )
    `)
    .bind(
      charge.classId,
      charge.amount,
      charge.id,
      charge.title,
      paidAt,
      paidBy,
    );

  const classBalanceUpdate = db
    .prepare(`
      UPDATE classes
      SET
        balance = balance + ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(
      charge.amount,
      paidAt,
      charge.classId,
    );

  const results = await db.batch([
    chargeUpdate,
    balanceTransaction,
    classBalanceUpdate,
  ]);

  const chargeUpdateResult = results[0];

  if (chargeUpdateResult.meta.changes !== 1) {
    throw new ConflictError(
      "Charge could not be marked as paid",
    );
  }

  const updatedCharge = await getChargeById(
    db,
    chargeId,
  );

  if (!updatedCharge) {
    throw new Error("Failed to load paid charge");
  }

  return updatedCharge;
}
