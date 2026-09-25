import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getExpenseById } from "../../db/repositories/expenses";
import {
  requireAuthenticatedUser,
  requireAdminOrClassRole,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import { cancelExpense } from "../../services/expenses";

export async function cancelExpenseHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/expenses\/(\d+)\/cancel$/,
  );

  if (!match) {
    throw new NotFoundError("Expense not found");
  }

  const id = Number(match[1]);
  const db = getDb(env);

  const expense = await getExpenseById(db, id);

  if (!expense) {
    throw new NotFoundError("Expense not found");
  }

  requireAdminOrClassRole(
    authContext.user,
    expense.classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const cancelledExpense = await cancelExpense(
    db,
    expense.id,
    authContext.user.id,
  );

  return successResponse({
    expense: cancelledExpense,
  });
}
