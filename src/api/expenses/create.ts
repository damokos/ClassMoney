import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { createExpense } from "../../db/repositories/expenses";
import {
  requireAuthenticatedUser,
  requireAdminOrClassRole,
} from "../../auth/authorization";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function createExpenseHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/classes\/(\d+)\/expenses$/,
  );

  if (!match) {
    throw new BadRequestError("Invalid expense path");
  }

  const classId = Number(match[1]);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError(
      "Request body must be an object",
    );
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.expenseDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)
  ) {
    throw new BadRequestError(
      "Expense date must be in YYYY-MM-DD format",
    );
  }

  if (
    typeof input.title !== "string" ||
    input.title.trim().length === 0
  ) {
    throw new BadRequestError("Title is required");
  }

  if (
    typeof input.category !== "string" ||
    input.category.trim().length === 0
  ) {
    throw new BadRequestError("Category is required");
  }

  if (
    typeof input.amount !== "number" ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    throw new BadRequestError(
      "Amount must be a positive integer",
    );
  }

  if (
    typeof input.receiptKey !== "string" ||
    input.receiptKey.trim().length === 0
  ) {
    throw new BadRequestError("Receipt key is required");
  }

  if (
    typeof input.receiptMimeType !== "string" ||
    input.receiptMimeType.trim().length === 0
  ) {
    throw new BadRequestError(
      "Receipt MIME type is required",
    );
  }

  requireAdminOrClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const expense = await createExpense(
    getDb(env),
    {
      classId,
      expenseDate: input.expenseDate,
      title: input.title.trim(),
      category: input.category.trim(),
      amount: input.amount,
      receiptKey: input.receiptKey.trim(),
      receiptMimeType: input.receiptMimeType.trim(),
    },
    authContext.user.id,
  );

  return successResponse(
    {
      expense,
    },
    201,
  );
}
