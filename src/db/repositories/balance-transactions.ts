export type BalanceTransactionType =
  | "INITIAL_BALANCE"
  | "CHARGE_PAID"
  | "CHARGE_CANCELLED"
  | "EXPENSE_PAID"
  | "EXPENSE_CANCELLED"
  | "FINANCIAL_TRANSACTION_PAID"
  | "FINANCIAL_TRANSACTION_CANCELLED";

export type BalanceTransactionReferenceType =
  | "class"
  | "charge"
  | "expense"
  | "financial_transaction";

export interface BalanceTransaction {
  id: number;
  classId: number;
  amount: number;
  transactionType: BalanceTransactionType;
  referenceType: BalanceTransactionReferenceType;
  referenceId: number;
  description: string | null;
  createdAt: string;
  createdBy: number;
}

interface BalanceTransactionRow {
  id: number;
  class_id: number;
  amount: number;
  transaction_type: BalanceTransactionType;
  reference_type: BalanceTransactionReferenceType;
  reference_id: number;
  description: string | null;
  created_at: string;
  created_by: number;
}

function mapBalanceTransaction(
  row: BalanceTransactionRow,
): BalanceTransaction {
  return {
    id: row.id,
    classId: row.class_id,
    amount: row.amount,
    transactionType: row.transaction_type,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    description: row.description,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

const BALANCE_TRANSACTION_COLUMNS = `
  id,
  class_id,
  amount,
  transaction_type,
  reference_type,
  reference_id,
  description,
  created_at,
  created_by
`;

export async function getBalanceTransactionById(
  db: D1Database,
  id: number,
): Promise<BalanceTransaction | null> {
  const row = await db
    .prepare(`
      SELECT ${BALANCE_TRANSACTION_COLUMNS}
      FROM balance_transactions
      WHERE id = ?
    `)
    .bind(id)
    .first<BalanceTransactionRow>();

  return row ? mapBalanceTransaction(row) : null;
}

export async function listBalanceTransactionsForClass(
  db: D1Database,
  classId: number,
): Promise<BalanceTransaction[]> {
  const result = await db
    .prepare(`
      SELECT ${BALANCE_TRANSACTION_COLUMNS}
      FROM balance_transactions
      WHERE class_id = ?
      ORDER BY id DESC
    `)
    .bind(classId)
    .all<BalanceTransactionRow>();

  return result.results.map(mapBalanceTransaction);
}

export async function listBalanceTransactionsForReference(
  db: D1Database,
  referenceType: BalanceTransactionReferenceType,
  referenceId: number,
): Promise<BalanceTransaction[]> {
  const result = await db
    .prepare(`
      SELECT ${BALANCE_TRANSACTION_COLUMNS}
      FROM balance_transactions
      WHERE reference_type = ?
        AND reference_id = ?
      ORDER BY id
    `)
    .bind(
      referenceType,
      referenceId,
    )
    .all<BalanceTransactionRow>();

  return result.results.map(mapBalanceTransaction);
}

export async function createBalanceTransaction(
  db: D1Database,
  input: {
    classId: number;
    amount: number;
    transactionType: BalanceTransactionType;
    referenceType: BalanceTransactionReferenceType;
    referenceId: number;
    description?: string | null;
    createdBy: number;
  },
): Promise<BalanceTransaction> {
  const now = new Date().toISOString();

  const row = await db
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING ${BALANCE_TRANSACTION_COLUMNS}
    `)
    .bind(
      input.classId,
      input.amount,
      input.transactionType,
      input.referenceType,
      input.referenceId,
      input.description ?? null,
      now,
      input.createdBy,
    )
    .first<BalanceTransactionRow>();

  if (!row) {
    throw new Error(
      "Failed to create balance transaction",
    );
  }

  return mapBalanceTransaction(row);
}
