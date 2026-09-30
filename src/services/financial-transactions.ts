import type { FinancialTransaction } from "../domain/financial/types";
import { getFinancialTransactionById } from "../db/repositories/financial-transactions";
import {
  ConflictError,
  NotFoundError,
} from "../http/errors";

export async function payFinancialTransaction(
  db: D1Database,
  transactionId: number,
  paidBy: number,
): Promise<FinancialTransaction> {
  const transaction = await getFinancialTransactionById(
    db,
    transactionId,
  );

  if (!transaction) {
    throw new NotFoundError("Financial transaction not found");
  }

  if (transaction.status !== "UNPAID") {
    throw new ConflictError(
      `Financial transaction cannot be paid because its status is ${transaction.status}`,
    );
  }

  const paidAt = new Date().toISOString();

  const transactionUpdate = db
    .prepare(`
      UPDATE financial_transactions
      SET
        status = 'PAID',
        paid_at = ?,
        paid_by = ?
      WHERE id = ?
        AND status = 'UNPAID'
    `)
    .bind(
      paidAt,
      paidBy,
      transactionId,
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
      SELECT
        ?,
        ?,
        'FINANCIAL_TRANSACTION_PAID',
        'financial_transaction',
        ?,
        ?,
        ?,
        ?
      WHERE changes() = 1
    `)
    .bind(
      transaction.classId,
      transaction.amount,
      transaction.id,
      transaction.description,
      paidAt,
      paidBy,
    );

  const classBalanceUpdate = db
    .prepare(`
      UPDATE classes
      SET
        balance = balance + ?,
        updated_at = ?
      WHERE id = ? AND changes() = 1
    `)
    .bind(
      transaction.amount,
      paidAt,
      transaction.classId,
    );

  const results = await db.batch([
    transactionUpdate,
    balanceTransaction,
    classBalanceUpdate,
  ]);

  const transactionUpdateResult = results[0];

  if (transactionUpdateResult.meta.changes !== 1) {
    throw new ConflictError(
      "Financial transaction could not be marked as paid",
    );
  }

  const updatedTransaction =
    await getFinancialTransactionById(
      db,
      transactionId,
    );

  if (!updatedTransaction) {
    throw new Error(
      "Failed to load paid financial transaction",
    );
  }

  return updatedTransaction;
}

export async function cancelFinancialTransaction(
  db: D1Database,
  transactionId: number,
  cancelledBy: number,
): Promise<FinancialTransaction> {
  const transaction = await getFinancialTransactionById(
    db,
    transactionId,
  );

  if (!transaction) {
    throw new NotFoundError("Financial transaction not found");
  }

  if (transaction.status === "CANCELLED") {
    throw new ConflictError(
      "Financial transaction is already cancelled",
    );
  }

  const cancelledAt = new Date().toISOString();

  const transactionUpdate = db
    .prepare(`
      UPDATE financial_transactions
      SET
        status = 'CANCELLED',
        cancelled_at = ?,
        cancelled_by = ?
      WHERE id = ?
        AND status IN ('UNPAID', 'PAID')
    `)
    .bind(
      cancelledAt,
      cancelledBy,
      transactionId,
    );

  const statements = [transactionUpdate,
      db
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
          SELECT class_id, -amount, 'FINANCIAL_TRANSACTION_CANCELLED', 'financial_transaction', id, description, ?, ?
          FROM financial_transactions WHERE id = ? AND status = 'CANCELLED' AND paid_at IS NOT NULL
            AND changes() = 1
        `)
        .bind(
          cancelledAt,
          cancelledBy,
          transactionId,
        ),
      db
        .prepare(`
          UPDATE classes
          SET
            balance = balance - (SELECT amount FROM financial_transactions WHERE id = ?),
            updated_at = ?
          WHERE id = ? AND changes() = 1
        `)
        .bind(
          transactionId,
          cancelledAt,
          transaction.classId,
        ),
  ];

  const results = await db.batch(statements);

  const transactionUpdateResult = results[0];

  if (transactionUpdateResult.meta.changes !== 1) {
    throw new ConflictError(
      "Financial transaction could not be cancelled",
    );
  }

  const updatedTransaction =
    await getFinancialTransactionById(
      db,
      transactionId,
    );

  if (!updatedTransaction) {
    throw new Error(
      "Failed to load cancelled financial transaction",
    );
  }

  return updatedTransaction;
}
