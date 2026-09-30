import type { Expense } from "../domain/expenses/types";
import { getExpenseById } from "../db/repositories/expenses";
import {
  ConflictError,
  NotFoundError,
} from "../http/errors";

export async function payExpense(
  db: D1Database,
  expenseId: number,
  paidBy: number,
): Promise<Expense> {
  const expense = await getExpenseById(db, expenseId);

  if (!expense) {
    throw new NotFoundError("Expense not found");
  }

  if (expense.status !== "UNPAID") {
    throw new ConflictError(
      `Expense cannot be paid because its status is ${expense.status}`,
    );
  }

  const paidAt = new Date().toISOString();

  const expenseUpdate = db
    .prepare(`
      UPDATE expenses
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
      expenseId,
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
        'EXPENSE_PAID',
        'expense',
        ?,
        ?,
        ?,
        ?
      WHERE changes() = 1
    `)
    .bind(
      expense.classId,
      -expense.amount,
      expense.id,
      expense.title,
      paidAt,
      paidBy,
    );

  const classBalanceUpdate = db
    .prepare(`
      UPDATE classes
      SET
        balance = balance - ?,
        updated_at = ?
      WHERE id = ? AND changes() = 1
    `)
    .bind(
      expense.amount,
      paidAt,
      expense.classId,
    );

  const results = await db.batch([
    expenseUpdate,
    balanceTransaction,
    classBalanceUpdate,
  ]);

  const expenseUpdateResult = results[0];

  if (expenseUpdateResult.meta.changes !== 1) {
    throw new ConflictError(
      "Expense could not be marked as paid",
    );
  }

  const updatedExpense = await getExpenseById(
    db,
    expenseId,
  );

  if (!updatedExpense) {
    throw new Error("Failed to load paid expense");
  }

  return updatedExpense;
}

export async function cancelExpense(
  db: D1Database,
  expenseId: number,
  cancelledBy: number,
): Promise<Expense> {
  const expense = await getExpenseById(db, expenseId);

  if (!expense) {
    throw new NotFoundError("Expense not found");
  }

  if (expense.status === "CANCELLED") {
    throw new ConflictError(
      "Expense is already cancelled",
    );
  }

  const cancelledAt = new Date().toISOString();

  const expenseUpdate = db
    .prepare(`
      UPDATE expenses
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
      expenseId,
    );

  const statements = [expenseUpdate,
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
          SELECT class_id, amount, 'EXPENSE_CANCELLED', 'expense', id, title, ?, ?
          FROM expenses WHERE id = ? AND status = 'CANCELLED' AND paid_at IS NOT NULL
            AND changes() = 1
        `)
        .bind(
          cancelledAt,
          cancelledBy,
          expenseId,
        ),
      db
        .prepare(`
          UPDATE classes
          SET
            balance = balance + (SELECT amount FROM expenses WHERE id = ?),
            updated_at = ?
          WHERE id = ? AND changes() = 1
        `)
        .bind(
          expenseId,
          cancelledAt,
          expense.classId,
        ),
  ];

  const results = await db.batch(statements);

  const expenseUpdateResult = results[0];

  if (expenseUpdateResult.meta.changes !== 1) {
    throw new ConflictError(
      "Expense could not be cancelled",
    );
  }

  const updatedExpense = await getExpenseById(
    db,
    expenseId,
  );

  if (!updatedExpense) {
    throw new Error("Failed to load cancelled expense");
  }

  return updatedExpense;
}
