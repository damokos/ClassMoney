export type FinancialTransactionStatus =
  | "UNPAID"
  | "PAID"
  | "CANCELLED";

export type FinancialTransactionCategoryCode =
  | "OTHER"
  | "FINANCIAL_ADJUSTMENT";

export interface FinancialTransactionCategory {
  id: number;
  code: FinancialTransactionCategoryCode;
  name: string;
  active: boolean;
  allowsSignedAmount: boolean;
  createdAt: string;
  createdBy: number | null;
}

export interface FinancialTransaction {
  id: number;
  classId: number;
  categoryId: number;
  categoryCode: FinancialTransactionCategoryCode;
  categoryName: string;
  description: string;
  amount: number;
  status: FinancialTransactionStatus;
  receiptKey: string | null;
  receiptMimeType: string | null;
  createdAt: string;
  createdBy: number;
  paidAt: string | null;
  paidBy: number | null;
  cancelledAt: string | null;
  cancelledBy: number | null;
}

export interface CreateFinancialTransactionInput {
  classId: number;
  categoryId: number;
  description: string;
  amount: number;
  receiptKey?: string | null;
  receiptMimeType?: string | null;
}

export interface UpdateFinancialTransactionCategoryInput {
  name?: string;
  active?: boolean;
  allowsSignedAmount?: boolean;
}

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
