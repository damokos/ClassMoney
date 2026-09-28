import type { Charge } from "../domain/charges/types";
import type { Expense } from "../domain/expenses/types";
import {
  createNotificationEvents,
  createUserCreatedNotificationEvents,
} from "../db/repositories/notifications";

export async function notifyUserCreated(
  db: D1Database,
  user: { id: number; email: string; createdAt: string },
): Promise<void> {
  try {
    await createUserCreatedNotificationEvents(db, user);
  } catch (error) {
    console.error("Unable to create new-user admin notification", user.id, error);
  }
}

async function createEvent(db: D1Database, code: string, classId: number, entityType: string, entityId: number, payload: Record<string, unknown>, childId?: number): Promise<void> {
  try {
    const [classItem, child] = await Promise.all([
      db.prepare("SELECT display_name, currency, currency_decimals FROM classes WHERE id = ?").bind(classId)
        .first<{ display_name: string; currency: string; currency_decimals: number }>(),
      childId ? db.prepare("SELECT name FROM children WHERE id = ?").bind(childId).first<{ name: string }>() : Promise.resolve(null),
    ]);
    await createNotificationEvents(db, code, classId, entityType, entityId, {
      ...payload,
      className: classItem?.display_name,
      currency: classItem?.currency,
      currencyDecimals: classItem?.currency_decimals,
      childName: child?.name,
    }, childId);
  }
  catch (error) { console.error("Unable to create notification event", code, error); }
}

export async function notifyChargeCreated(db: D1Database, charge: Charge): Promise<void> {
  const payload = { title: charge.title, amount: charge.amount, dueDate: charge.dueDate, childId: charge.childId };
  await Promise.all([
    createEvent(db, "CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD", charge.classId, "charge", charge.id, payload, charge.childId),
    createEvent(db, "CHARGE_ASSIGNED_OR_CANCELLED", charge.classId, "charge", charge.id, payload, charge.childId),
  ]);
}

export async function notifyChargeCancelled(db: D1Database, charge: Charge): Promise<void> {
  const payload = { title: charge.title, amount: charge.amount, childId: charge.childId, status: charge.status };
  await Promise.all([
    createEvent(db, "CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD", charge.classId, "charge_cancelled", charge.id, payload, charge.childId),
    createEvent(db, "CHARGE_ASSIGNED_OR_CANCELLED", charge.classId, "charge_cancelled", charge.id, payload, charge.childId),
  ]);
}

export async function notifyChargePaid(db: D1Database, charge: Charge): Promise<void> {
  await createEvent(db, "CHARGE_MARKED_PAID", charge.classId, "charge_paid", charge.id,
    { title: charge.title, amount: charge.amount, childId: charge.childId }, charge.childId);
}

export async function notifyExpenseCreated(db: D1Database, expense: Expense): Promise<void> {
  await createEvent(db, "EXPENSE_CREATED", expense.classId, "expense", expense.id,
    { title: expense.title, amount: expense.amount, category: expense.category, expenseDate: expense.expenseDate });
}

export async function notifyExpenseCancelled(db: D1Database, expense: Expense): Promise<void> {
  await createEvent(db, "EXPENSE_CANCELLED", expense.classId, "expense_cancelled", expense.id,
    { title: expense.title, amount: expense.amount, category: expense.category, expenseDate: expense.expenseDate });
}

export async function notifyExpensePaid(db: D1Database, expense: Expense): Promise<void> {
  await createEvent(db, "EXPENSE_MARKED_PAID", expense.classId, "expense_paid", expense.id,
    { title: expense.title, amount: expense.amount, category: expense.category, expenseDate: expense.expenseDate });
}
