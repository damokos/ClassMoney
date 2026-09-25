export type ChargeStatus =
  | "PENDING"
  | "PAID"
  | "CANCELLED";

export interface Charge {
  id: number;
  classId: number;
  childId: number;
  title: string;
  amount: number;
  dueDate: string;
  status: ChargeStatus;
  paidAt: string | null;
  paidBy: number | null;
  cancelledAt: string | null;
  cancelledBy: number | null;
  batchId: number | null;
  createdAt: string;
  createdBy: number;
}

export interface CreateChargeInput {
  classId: number;
  childId: number;
  title: string;
  amount: number;
  dueDate: string;
  batchId?: number | null;
}

export interface ChargeBatch {
  id: number;
  classId: number;
  createdAt: string;
  createdBy: number;
}

export interface CreateChargeBatchInput {
  classId: number;
}
