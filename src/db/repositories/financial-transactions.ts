import type {
  FinancialTransaction,
  FinancialTransactionCategory,
  FinancialTransactionCategoryCode,
  FinancialTransactionStatus,
  CreateFinancialTransactionInput,
} from "../../domain/financial/types";

interface FinancialTransactionCategoryRow {
  id: number;
  code: FinancialTransactionCategoryCode;
  name: string;
  active: number;
  allows_signed_amount: number;
  created_at: string;
  created_by: number | null;
}

interface FinancialTransactionRow {
  id: number;
  class_id: number;
  category_id: number;
  category_code: FinancialTransactionCategoryCode;
  category_name: string;
  description: string;
  amount: number;
  status: FinancialTransactionStatus;
  receipt_key: string | null;
  receipt_mime_type: string | null;
  created_at: string;
  created_by: number;
  paid_at: string | null;
  paid_by: number | null;
  cancelled_at: string | null;
  cancelled_by: number | null;
}

function mapCategory(
  row: FinancialTransactionCategoryRow,
): FinancialTransactionCategory {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active === 1,
    allowsSignedAmount: row.allows_signed_amount === 1,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function mapFinancialTransaction(
  row: FinancialTransactionRow,
): FinancialTransaction {
  return {
    id: row.id,
    classId: row.class_id,
    categoryId: row.category_id,
    categoryCode: row.category_code,
    categoryName: row.category_name,
    description: row.description,
    amount: row.amount,
    status: row.status,
    receiptKey: row.receipt_key,
    receiptMimeType: row.receipt_mime_type,
    createdAt: row.created_at,
    createdBy: row.created_by,
    paidAt: row.paid_at,
    paidBy: row.paid_by,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
  };
}

const CATEGORY_COLUMNS = `
  id,
  code,
  name,
  active,
  allows_signed_amount,
  created_at,
  created_by
`;

const FINANCIAL_TRANSACTION_COLUMNS = `
  ft.id,
  ft.class_id,
  ft.category_id,
  c.code AS category_code,
  c.name AS category_name,
  ft.description,
  ft.amount,
  ft.status,
  ft.receipt_key,
  ft.receipt_mime_type,
  ft.created_at,
  ft.created_by,
  ft.paid_at,
  ft.paid_by,
  ft.cancelled_at,
  ft.cancelled_by
`;

export async function getFinancialTransactionCategoryById(
  db: D1Database,
  id: number,
): Promise<FinancialTransactionCategory | null> {
  const row = await db
    .prepare(`
      SELECT ${CATEGORY_COLUMNS}
      FROM financial_transaction_categories
      WHERE id = ?
    `)
    .bind(id)
    .first<FinancialTransactionCategoryRow>();

  return row ? mapCategory(row) : null;
}

export async function getActiveFinancialTransactionCategories(
  db: D1Database,
): Promise<FinancialTransactionCategory[]> {
  const result = await db
    .prepare(`
      SELECT ${CATEGORY_COLUMNS}
      FROM financial_transaction_categories
      WHERE active = 1
      ORDER BY name, id
    `)
    .all<FinancialTransactionCategoryRow>();

  return result.results.map(mapCategory);
}

export async function getFinancialTransactionById(
  db: D1Database,
  id: number,
): Promise<FinancialTransaction | null> {
  const row = await db
    .prepare(`
      SELECT ${FINANCIAL_TRANSACTION_COLUMNS}
      FROM financial_transactions ft
      INNER JOIN financial_transaction_categories c
        ON c.id = ft.category_id
      WHERE ft.id = ?
    `)
    .bind(id)
    .first<FinancialTransactionRow>();

  return row ? mapFinancialTransaction(row) : null;
}

export async function getFinancialTransactionByIdForClass(
  db: D1Database,
  classId: number,
  id: number,
): Promise<FinancialTransaction | null> {
  const row = await db
    .prepare(`
      SELECT ${FINANCIAL_TRANSACTION_COLUMNS}
      FROM financial_transactions ft
      INNER JOIN financial_transaction_categories c
        ON c.id = ft.category_id
      WHERE ft.class_id = ?
        AND ft.id = ?
    `)
    .bind(classId, id)
    .first<FinancialTransactionRow>();

  return row ? mapFinancialTransaction(row) : null;
}

export async function listFinancialTransactionsForClass(
  db: D1Database,
  classId: number,
  includeCancelled = false,
): Promise<FinancialTransaction[]> {
  const query = includeCancelled
    ? `
      SELECT ${FINANCIAL_TRANSACTION_COLUMNS}
      FROM financial_transactions ft
      INNER JOIN financial_transaction_categories c
        ON c.id = ft.category_id
      WHERE ft.class_id = ?
      ORDER BY ft.created_at, ft.id
    `
    : `
      SELECT ${FINANCIAL_TRANSACTION_COLUMNS}
      FROM financial_transactions ft
      INNER JOIN financial_transaction_categories c
        ON c.id = ft.category_id
      WHERE ft.class_id = ?
        AND ft.status != 'CANCELLED'
      ORDER BY ft.created_at, ft.id
    `;

  const result = await db
    .prepare(query)
    .bind(classId)
    .all<FinancialTransactionRow>();

  return result.results.map(mapFinancialTransaction);
}

export async function createFinancialTransaction(
  db: D1Database,
  input: CreateFinancialTransactionInput,
  createdBy: number,
): Promise<FinancialTransaction> {
  const now = new Date().toISOString();

  const row = await db
    .prepare(`
      INSERT INTO financial_transactions (
        class_id,
        category_id,
        description,
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
        'UNPAID',
        ?,
        ?,
        ?,
        ?
      )
      RETURNING id
    `)
    .bind(
      input.classId,
      input.categoryId,
      input.description,
      input.amount,
      input.receiptKey ?? null,
      input.receiptMimeType ?? null,
      now,
      createdBy,
    )
    .first<{ id: number }>();

  if (!row) {
    throw new Error("Failed to create financial transaction");
  }

  const transaction = await getFinancialTransactionById(
    db,
    row.id,
  );

  if (!transaction) {
    throw new Error(
      "Failed to load created financial transaction",
    );
  }

  return transaction;
}
