import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { createExpense } from "../../db/repositories/expenses";
import {
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";
import { notifyExpenseCreated } from "../../services/notifications";

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
const RECEIPT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isValidReceiptSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "application/pdf") {
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  }
  if (type === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

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
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_RECEIPT_SIZE + 64 * 1024) {
    throw new BadRequestError("Receipt file must be 10 MB or smaller");
  }

  let input: FormData;
  try {
    input = await request.formData();
  } catch {
    throw new BadRequestError("Invalid form data");
  }

  const receipt = input.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    throw new BadRequestError("Receipt file is required");
  }
  if (receipt.size > MAX_RECEIPT_SIZE) {
    throw new BadRequestError("Receipt file must be 10 MB or smaller");
  }
  const receiptMimeType = receipt.type.toLowerCase();
  if (!RECEIPT_TYPES.has(receiptMimeType)) {
    throw new BadRequestError("Receipt must be a PDF, JPEG, PNG, or WebP file");
  }

  if (
    typeof input.get("expenseDate") !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.get("expenseDate") as string)
  ) {
    throw new BadRequestError(
      "Expense date must be in YYYY-MM-DD format",
    );
  }

  if (
    typeof input.get("title") !== "string" ||
    (input.get("title") as string).trim().length === 0
  ) {
    throw new BadRequestError("Title is required");
  }

  if (
    typeof input.get("category") !== "string" ||
    (input.get("category") as string).trim().length === 0
  ) {
    throw new BadRequestError("Category is required");
  }

  if (
    typeof input.get("amount") !== "string" ||
    !/^\d+$/.test(input.get("amount") as string) ||
    Number(input.get("amount")) <= 0 ||
    !Number.isSafeInteger(Number(input.get("amount")))
  ) {
    throw new BadRequestError(
      "Amount must be a positive integer",
    );
  }

  requireAnyClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const db = getDb(env);
  const bytes = new Uint8Array(await receipt.arrayBuffer());
  if (!isValidReceiptSignature(receiptMimeType, bytes)) {
    throw new BadRequestError(
      "Receipt contents do not match the selected file type",
    );
  }

  const receiptKey = `classes/${classId}/expenses/${crypto.randomUUID()}`;
  await env.R2.put(receiptKey, bytes, {
    httpMetadata: { contentType: receiptMimeType },
  });

  let expense;
  try {
    expense = await createExpense(
      db,
      {
        classId,
        expenseDate: input.get("expenseDate") as string,
        title: (input.get("title") as string).trim(),
        category: (input.get("category") as string).trim(),
        amount: Number(input.get("amount")),
        receiptKey,
        receiptMimeType,
      },
      authContext.user.id,
    );
  } catch (error) {
    await env.R2.delete(receiptKey);
    throw error;
  }

  await notifyExpenseCreated(db, expense);

  return successResponse(
    {
      expense,
    },
    201,
  );
}
