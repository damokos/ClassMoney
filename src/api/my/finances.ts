import type { Env } from "../../types/env";
import type { AuthContext } from "../../auth/context";
import { requireAuthenticatedUser } from "../../auth/authorization";
import { listChildrenForUser } from "../../db/repositories/children";
import { listChargesForUser } from "../../db/repositories/charges";
import { successResponse } from "../../http/response";

export async function myFinancesHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  const user = authContext?.user ?? null;

  requireAuthenticatedUser(user);

  const [children, charges] = await Promise.all([
    listChildrenForUser(env.DB, user.id),
    listChargesForUser(env.DB, user.id),
  ]);

  return successResponse({
    children: children.map((child) => ({
      id: child.id,
      name: child.name,
      classId: child.classId,
      classDisplayName: child.classDisplayName,
      bankAccountNumber: child.bankAccountNumber,
    })),
    charges: charges.map((charge) => ({
      id: charge.id,
      childId: charge.childId,
      title: charge.title,
      amount: charge.amount,
      currency: charge.currency,
      currencyDecimals: charge.currencyDecimals,
      dueDate: charge.dueDate,
      status: charge.status,
      paidAt: charge.paidAt,
    })),
  });
}
