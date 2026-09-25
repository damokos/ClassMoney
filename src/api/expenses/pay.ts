import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getExpenseById } from "../../db/repositories/expenses";
import {
  requireAuthenticatedUser,
  requireTreasurer,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import { payExpense } from "../../services/expenses";

export async function payExpenseHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/expenses\/(\d+)\/pay$/,
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

  requireTreasurer(
    authContext.user,
    expense.classId,
  );

  const paidExpense = await payExpense(
    db,
    expense.id,
    authContext.user.id,
  );

  return successResponse({
    expense: paidExpense,
  });
}
