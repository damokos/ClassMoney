import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getFinancialTransactionById } from "../../db/repositories/financial-transactions";
import {
  requireAuthenticatedUser,
  requireAdminOrClassRole,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import { cancelFinancialTransaction } from "../../services/financial-transactions";

export async function cancelFinancialTransactionHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/financial-transactions\/(\d+)\/cancel$/,
  );

  if (!match) {
    throw new NotFoundError(
      "Financial transaction not found",
    );
  }

  const id = Number(match[1]);
  const db = getDb(env);

  const transaction =
    await getFinancialTransactionById(db, id);

  if (!transaction) {
    throw new NotFoundError(
      "Financial transaction not found",
    );
  }

  requireAdminOrClassRole(
    authContext.user,
    transaction.classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const cancelledTransaction =
    await cancelFinancialTransaction(
      db,
      transaction.id,
      authContext.user.id,
    );

  return successResponse({
    financialTransaction: cancelledTransaction,
  });
}
