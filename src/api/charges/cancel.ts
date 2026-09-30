import type { AuthContext } from "../../auth/types";
import {
  requireAnyClassRole,
  requireAuthenticatedUser,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import {
  getChargeById,
} from "../../db/repositories/charges";
import {
  getClassById,
} from "../../db/repositories/classes";
import {
  ConflictError,
  NotFoundError,
} from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";
import { notifyChargeCancelled } from "../../services/notifications";

export async function cancelChargeHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const chargeId = Number(
    parts[parts.indexOf("charges") + 1],
  );

  if (
    !Number.isInteger(chargeId) ||
    chargeId <= 0
  ) {
    throw new NotFoundError("Charge not found");
  }

  const db = getDb(env);

  const charge = await getChargeById(
    db,
    chargeId,
  );

  if (!charge) {
    throw new NotFoundError("Charge not found");
  }

  requireAnyClassRole(
    authContext.user,
    charge.classId,
    [
      "PARENT_REPRESENTATIVE",
      "TREASURER",
    ],
  );

  const classItem = await getClassById(
    db,
    charge.classId,
  );

  if (!classItem) {
    throw new NotFoundError("Class not found");
  }
  if (!classItem.active) throw new ConflictError("Archived classes are read-only");

  if (charge.status === "CANCELLED") {
    throw new ConflictError(
      "Charge is already cancelled",
    );
  }

  const now = new Date().toISOString();

  if (charge.status === "PENDING") {
    const result = await db
      .prepare(`
        UPDATE charges
        SET
          status = 'CANCELLED',
          cancelled_at = ?,
          cancelled_by = ?
        WHERE id = ?
          AND status = 'PENDING'
      `)
      .bind(
        now,
        authContext.user.id,
        chargeId,
      )
      .run();

    if (!result.meta.changes) {
      throw new ConflictError(
        "Charge state changed before cancellation",
      );
    }
  } else if (charge.status === "PAID") {
    const results = await db.batch([
      db
        .prepare(`
          UPDATE charges
          SET
            status = 'CANCELLED',
            cancelled_at = ?,
            cancelled_by = ?
          WHERE id = ?
            AND status = 'PAID'
        `)
        .bind(
          now,
          authContext.user.id,
          chargeId,
        ),

      db
        .prepare(`
          INSERT INTO balance_transactions (
            class_id, amount, transaction_type, reference_type, reference_id,
            description, created_at, created_by
          )
          SELECT ?, ?, 'CHARGE_CANCELLED', 'charge', ?, ?, ?, ?
          WHERE changes() = 1
        `)
        .bind(charge.classId, -charge.amount, chargeId, charge.title, now, authContext.user.id),
      db
        .prepare(`
          UPDATE classes
          SET
            balance = balance - ?,
            updated_at = ?
          WHERE id = ? AND changes() = 1
        `)
        .bind(
          charge.amount,
          now,
          charge.classId,
        ),

    ]);

    if (!results[0].meta.changes) {
      throw new ConflictError(
        "Charge state changed before cancellation",
      );
    }
  } else {
    throw new ConflictError(
      "Charge cannot be cancelled in its current state",
    );
  }

  const cancelledCharge = await getChargeById(
    db,
    chargeId,
  );

  if (!cancelledCharge) {
    throw new NotFoundError("Charge not found");
  }

  await notifyChargeCancelled(db, cancelledCharge);

  return successResponse({
    charge: cancelledCharge,
  });
}
