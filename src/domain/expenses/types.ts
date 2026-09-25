export type ExpenseStatus =
  | "UNPAID"
  | "PAID"
  | "CANCELLED";

export interface Expense {
  id: number;
  classId: number;
  expenseDate: string;
  title: string;
  category: string;
  amount: number;
  status: ExpenseStatus;
  receiptKey: string;
  receiptMimeType: string;
  paidAt: string | null;
  paidBy: number | null;
  cancelledAt: string | null;
  cancelledBy: number | null;
  createdAt: string;
  createdBy: number;
}

export interface CreateExpenseInput {
  classId: number;
  expenseDate: string;
  title: string;
  category: string;
  amount: number;
  receiptKey: string;
  receiptMimeType: string;
}
