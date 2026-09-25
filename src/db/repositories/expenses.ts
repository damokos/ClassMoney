import type {
  Expense,
  ExpenseStatus,
  CreateExpenseInput,
} from "../../domain/expenses/types";

interface ExpenseRow {
  id: number;
  class_id: number;
  expense_date: string;
  title: string;
  category: string;
  amount: number;
  status: ExpenseStatus;
  receipt_key: string;
  receipt_mime_type: string;
  paid_at: string | null;
  paid_by: number | null;
  cancelled_at: string | null;
  cancelled_by: number | null;
  created_at: string;
  created_by: number;
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    classId: row.class_id,
    expenseDate: row.expense_date,
    title: row.title,
    category: row.category,
    amount: row.amount,
    status: row.status,
    receiptKey: row.receipt_key,
    receiptMimeType: row.receipt_mime_type,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

const EXPENSE_COLUMNS = `
  id,
  class_id,
  expense_date,
  title,
  category,
  amount,
  status,
  receipt_key,
  receipt_mime_type,
  paid_at,
  paid_by,
  cancelled_at,
  cancelled_by,
  created_at,
  created_by
`;

export async function getExpenseById(
  db: D1Database,
  id: number,
): Promise<Expense | null> {
  const row = await db
    .prepare(`
      SELECT ${EXPENSE_COLUMNS}
      FROM expenses
      WHERE id = ?
    `)
    .bind(id)
    .first<ExpenseRow>();

  return row ? mapExpense(row) : null;
}

export async function getExpenseByIdForClass(
  db: D1Database,
  classId: number,
  id: number,
): Promise<Expense | null> {
  const row = await db
    .prepare(`
      SELECT ${EXPENSE_COLUMNS}
      FROM expenses
      WHERE class_id = ?
        AND id = ?
    `)
    .bind(classId, id)
    .first<ExpenseRow>();

  return row ? mapExpense(row) : null;
}

export async function listExpensesForClass(
  db: D1Database,
  classId: number,
  includeCancelled = false,
): Promise<Expense[]> {
  const query = includeCancelled
    ? `
      SELECT ${EXPENSE_COLUMNS}
      FROM expenses
      WHERE class_id = ?
      ORDER BY expense_date, id
    `
    : `
      SELECT ${EXPENSE_COLUMNS}
      FROM expenses
      WHERE class_id = ?
        AND status != 'CANCELLED'
      ORDER BY expense_date, id
    `;

  const result = await db
    .prepare(query)
    .bind(classId)
    .all<ExpenseRow>();

  return result.results.map(mapExpense);
}

export async function createExpense(
  db: D1Database,
  input: CreateExpenseInput,
  createdBy: number,
): Promise<Expense> {
  const now = new Date().toISOString();

  const row = await db
    .prepare(`
      INSERT INTO expenses (
        class_id,
        expense_date,
        title,
        category,
        amount,
        status,
        receipt_key,
        receipt_mime_type,
        created_at,
        created_by
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        'UNPAID',
        ?,
        ?,
        ?,
        ?
      )
      RETURNING ${EXPENSE_COLUMNS}
    `)
    .bind(
      input.classId,
      input.expenseDate,
      input.title,
      input.category,
      input.amount,
      input.receiptKey,
      input.receiptMimeType,
      now,
      createdBy,
    )
    .first<ExpenseRow>();

  if (!row) {
    throw new Error("Failed to create expense");
  }

  return mapExpense(row);
}
