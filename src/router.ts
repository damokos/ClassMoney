import type { Env } from "./types/env";
import { getAuthContext } from "./auth/context";
import { meHandler } from "./api/me";
import { listClassesHandler } from "./api/classes/list";
import { getClassHandler } from "./api/classes/get";
import { createClassHandler } from "./api/classes/create";
import { updateClassHandler } from "./api/classes/update";
import { getFinancesHandler } from "./api/finances/get";
import { createChildHandler } from "./api/children/create";
import { listChildrenHandler } from "./api/children/list";
import { getChildHandler } from "./api/children/get";
import { updateChildHandler } from "./api/children/update";
import { listUsersHandler } from "./api/users/list";
import { getUserHandler } from "./api/users/get";
import { updateUserHandler } from "./api/users/update";
import { payChargeHandler } from "./api/charges/pay";
import { createExpenseHandler } from "./api/expenses/create";
import { payExpenseHandler } from "./api/expenses/pay";
import { cancelExpenseHandler } from "./api/expenses/cancel";
import { createFinancialTransactionHandler } from "./api/financial-transactions/create";
import { payFinancialTransactionHandler } from "./api/financial-transactions/pay";
import { cancelFinancialTransactionHandler } from "./api/financial-transactions/cancel";
import { AppError } from "./http/errors";
import { errorResponse } from "./http/response";
import { createChargeHandler } from "./api/charges/create";
import { cancelChargeHandler } from "./api/charges/cancel";

export async function router(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const authContext = await getAuthContext(
      request,
      env,
      ctx,
    );

    if (method === "GET" && pathname === "/api/me") {
      return meHandler(
        request,
        env,
        authContext,
      );
    }

    if (
      method === "GET" &&
      pathname === "/api/classes"
    ) {
      return listClassesHandler(
        request,
        env,
        authContext,
      );
    }

    const classMatch = pathname.match(
      /^\/api\/classes\/(\d+)$/,
    );

    if (classMatch) {
      const classId = Number(classMatch[1]);

      if (method === "GET") {
        return getClassHandler(
          request,
          env,
          authContext,
        );
      }

      if (method === "PATCH") {
        return updateClassHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const classFinancesMatch = pathname.match(
      /^\/api\/classes\/(\d+)\/finances$/,
    );

    if (classFinancesMatch) {
      if (method === "GET") {
        return getFinancesHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const classChildrenMatch = pathname.match(
      /^\/api\/classes\/(\d+)\/children$/,
    );

    if (classChildrenMatch) {
      if (method === "GET") {
        return listChildrenHandler(
          request,
          env,
          authContext,
        );
      }

      if (method === "POST") {
        return createChildHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const childMatch = pathname.match(
      /^\/api\/children\/(\d+)$/,
    );

    if (childMatch) {
      if (method === "GET") {
        return getChildHandler(
          request,
          env,
          authContext,
        );
      }

      if (method === "PATCH") {
        return updateChildHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const classUsersMatch = pathname.match(
      /^\/api\/classes\/(\d+)\/users$/,
    );

    if (classUsersMatch) {
      if (method === "GET") {
        return listUsersHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const userMatch = pathname.match(
      /^\/api\/users\/(\d+)$/,
    );

    if (userMatch) {
      if (method === "GET") {
        return getUserHandler(
          request,
          env,
          authContext,
        );
      }

      if (method === "PATCH") {
        return updateUserHandler(
          request,
          env,
          authContext,
        );
      }
    }

    const classChargesMatch = pathname.match(
      /^\/api\/classes\/(\d+)\/charges$/,
    );

    if (
      classChargesMatch &&
      method === "POST"
    ) {
      return createChargeHandler(
        request,
        env,
        authContext,
      );
    }

    const chargeCancelMatch = pathname.match(
      /^\/api\/charges\/(\d+)\/cancel$/,
    );

    if (
      chargeCancelMatch &&
      method === "POST"
    ) {
      return cancelChargeHandler(
        request,
        env,
        authContext,
      );
    }

    const chargePayMatch = pathname.match(
      /^\/api\/charges\/(\d+)\/pay$/,
    );

    if (
      chargePayMatch &&
      method === "POST"
    ) {
      return payChargeHandler(
        request,
        env,
        authContext,
      );
    }

    const classExpensesMatch = pathname.match(
      /^\/api\/classes\/(\d+)\/expenses$/,
    );

    if (
      classExpensesMatch &&
      method === "POST"
    ) {
      return createExpenseHandler(
        request,
        env,
        authContext,
      );
    }

    const expensePayMatch = pathname.match(
      /^\/api\/expenses\/(\d+)\/pay$/,
    );

    if (
      expensePayMatch &&
      method === "POST"
    ) {
      return payExpenseHandler(
        request,
        env,
        authContext,
      );
    }

    const expenseCancelMatch = pathname.match(
      /^\/api\/expenses\/(\d+)\/cancel$/,
    );

    if (
      expenseCancelMatch &&
      method === "POST"
    ) {
      return cancelExpenseHandler(
        request,
        env,
        authContext,
      );
    }

    const classFinancialTransactionsMatch =
      pathname.match(
        /^\/api\/classes\/(\d+)\/financial-transactions$/,
      );

    if (
      classFinancialTransactionsMatch &&
      method === "POST"
    ) {
      return createFinancialTransactionHandler(
        request,
        env,
        authContext,
      );
    }

    const financialTransactionPayMatch =
      pathname.match(
        /^\/api\/financial-transactions\/(\d+)\/pay$/,
      );

    if (
      financialTransactionPayMatch &&
      method === "POST"
    ) {
      return payFinancialTransactionHandler(
        request,
        env,
        authContext,
      );
    }

    const financialTransactionCancelMatch =
      pathname.match(
        /^\/api\/financial-transactions\/(\d+)\/cancel$/,
      );

    if (
      financialTransactionCancelMatch &&
      method === "POST"
    ) {
      return cancelFinancialTransactionHandler(
        request,
        env,
        authContext,
      );
    }

    throw new AppError(
      404,
      "NOT_FOUND",
      "Not found",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
