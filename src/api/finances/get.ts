import type { AuthContext } from "../../auth/types";
import {
  hasGlobalRole,
  requireAnyClassRole,
  requireAuthenticatedUser,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { getClassById } from "../../db/repositories/classes";
import { listChargesForClass } from "../../db/repositories/charges";
import { listExpensesForClass } from "../../db/repositories/expenses";
import {
  listFinancialTransactionsForClass,
} from "../../db/repositories/financial-transactions";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function getFinancesHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const classId = Number(
    parts[parts.indexOf("classes") + 1],
  );

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new NotFoundError("Class not found");
  }

  const user = authContext.user;
  const isAdmin = hasGlobalRole(user, "ADMIN");

  if (!isAdmin) {
    requireAnyClassRole(
      user,
      classId,
      ["PARENT_REPRESENTATIVE", "TREASURER"],
    );
  }

  const classRecord = await getClassById(
    getDb(env),
    classId,
  );

  if (!classRecord) {
    throw new NotFoundError("Class not found");
  }

  const includeCancelled =
    url.searchParams.get("includeCancelled") === "true";

  const db = getDb(env);

  const [
    charges,
    expenses,
    financialTransactions,
  ] = await Promise.all([
    listChargesForClass(
      db,
      classId,
      includeCancelled,
    ),
    listExpensesForClass(
      db,
      classId,
      includeCancelled,
    ),
    listFinancialTransactionsForClass(
      db,
      classId,
      includeCancelled,
    ),
  ]);

  return successResponse({
    class: {
      id: classRecord.id,
      code: classRecord.code,
      displayName: classRecord.displayName,
      currency: classRecord.currency,
      currencyDecimals: classRecord.currencyDecimals,
      balance: classRecord.balance,
    },
    charges,
    expenses,
    financialTransactions,
  });
}
