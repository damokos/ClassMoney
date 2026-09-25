import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import {
  getFinancialTransactionCategoryById,
  createFinancialTransaction,
} from "../../db/repositories/financial-transactions";
import {
  requireAuthenticatedUser,
  requireAdminOrClassRole,
} from "../../auth/authorization";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function createFinancialTransactionHandler(
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
    typeof input.categoryId !== "number" ||
    !Number.isInteger(input.categoryId) ||
    input.categoryId <= 0
  ) {
    throw new BadRequestError(
      "Category ID must be a positive integer",
    );
  }

  if (
    typeof input.description !== "string" ||
    input.description.trim().length === 0
  ) {
    throw new BadRequestError(
      "Description is required",
    );
  }

  if (
    typeof input.amount !== "number" ||
    !Number.isInteger(input.amount) ||
    input.amount === 0
  ) {
    throw new BadRequestError(
      "Amount must be a non-zero integer",
    );
  }

  if (
    input.receiptKey !== undefined &&
    input.receiptKey !== null &&
    (
      typeof input.receiptKey !== "string" ||
      input.receiptKey.trim().length === 0
    )
  ) {
    throw new BadRequestError(
      "Receipt key must be a non-empty string",
    );
  }

  if (
    input.receiptMimeType !== undefined &&
    input.receiptMimeType !== null &&
    (
      typeof input.receiptMimeType !== "string" ||
      input.receiptMimeType.trim().length === 0
    )
  ) {
    throw new BadRequestError(
      "Receipt MIME type must be a non-empty string",
    );
  }

  if (
    (input.receiptKey === undefined ||
      input.receiptKey === null) &&
    input.receiptMimeType !== undefined &&
    input.receiptMimeType !== null
  ) {
    throw new BadRequestError(
      "Receipt MIME type requires a receipt key",
    );
  }

  if (
    input.receiptKey !== undefined &&
    input.receiptKey !== null &&
    (input.receiptMimeType === undefined ||
      input.receiptMimeType === null)
  ) {
    throw new BadRequestError(
      "Receipt key requires a receipt MIME type",
    );
  }

  requireAdminOrClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const db = env.DB;

  const category =
    await getFinancialTransactionCategoryById(
      db,
      input.categoryId,
    );

  if (!category) {
    throw new BadRequestError(
      "Financial transaction category not found",
    );
  }

  if (!category.active) {
    throw new BadRequestError(
      "Financial transaction category is inactive",
    );
  }

  if (!category.allowsSignedAmount && input.amount <= 0) {
    throw new BadRequestError(
      "Amount must be positive for this category",
    );
  }

  const financialTransaction =
    await createFinancialTransaction(
      db,
      {
        classId,
        categoryId: input.categoryId,
        description: input.description.trim(),
        amount: input.amount,
        receiptKey:
          typeof input.receiptKey === "string"
            ? input.receiptKey.trim()
            : null,
        receiptMimeType:
          typeof input.receiptMimeType === "string"
            ? input.receiptMimeType.trim()
            : null,
      },
      authContext.user.id,
    );

  return successResponse(
    {
      financialTransaction,
    },
    201,
  );
}
