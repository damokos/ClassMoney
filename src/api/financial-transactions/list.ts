import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { listFinancialTransactionsForClass } from "../../db/repositories/financial-transactions";
import {
  requireAuthenticatedUser,
  requireAdminOrClassRole,
} from "../../auth/authorization";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function listFinancialTransactionsHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/classes\/(\d+)\/financial-transactions$/,
  );

  if (!match) {
    throw new BadRequestError(
      "Invalid financial transaction path",
    );
  }

  const classId = Number(match[1]);

  requireAdminOrClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const includeCancelledParam =
    url.searchParams.get("includeCancelled");

  if (
    includeCancelledParam !== null &&
    includeCancelledParam !== "true" &&
    includeCancelledParam !== "false"
  ) {
    throw new BadRequestError(
      "includeCancelled must be true or false",
    );
  }

  const includeCancelled =
    includeCancelledParam === "true";

  const transactions =
    await listFinancialTransactionsForClass(
      getDb(env),
      classId,
      includeCancelled,
    );

  return successResponse({
    financialTransactions: transactions,
  });
}
