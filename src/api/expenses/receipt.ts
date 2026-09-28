import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getExpenseByIdForClass } from "../../db/repositories/expenses";
import {
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import { BadRequestError, NotFoundError } from "../../http/errors";

const RECEIPT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function getExpenseReceiptHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const match = new URL(request.url).pathname.match(
    /^\/api\/classes\/(\d+)\/expenses\/(\d+)\/receipt$/,
  );
  if (!match) {
    throw new BadRequestError("Invalid receipt path");
  }

  const classId = Number(match[1]);
  const expenseId = Number(match[2]);
  const expense = await getExpenseByIdForClass(
    getDb(env),
    classId,
    expenseId,
  );
  if (!expense) throw new NotFoundError("Receipt not found");

  requireAnyClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

  const extension = RECEIPT_EXTENSIONS[expense.receiptMimeType];
  if (
    !extension ||
    !expense.receiptKey.startsWith(`classes/${classId}/expenses/`)
  ) {
    throw new NotFoundError("Receipt not found");
  }

  const object = await env.R2.get(expense.receiptKey);
  if (!object) throw new NotFoundError("Receipt not found");

  return new Response(object.body, {
    headers: {
      "Content-Type": expense.receiptMimeType,
      "Content-Disposition": `inline; filename="receipt.${extension}"`,
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
