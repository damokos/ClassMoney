import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { createClass } from "../../db/repositories/classes";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function createClassHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be an object");
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.code !== "string" ||
    input.code.trim().length === 0
  ) {
    throw new BadRequestError("Code is required");
  }

  if (
    typeof input.displayName !== "string" ||
    input.displayName.trim().length === 0
  ) {
    throw new BadRequestError("Display name is required");
  }

  if (
    typeof input.currency !== "string" ||
    input.currency.trim().length !== 3
  ) {
    throw new BadRequestError("Currency must be a 3-letter code");
  }

  if (
    typeof input.currencyDecimals !== "number" ||
    !Number.isInteger(input.currencyDecimals) ||
    input.currencyDecimals < 0 ||
    input.currencyDecimals > 3
  ) {
    throw new BadRequestError(
      "Currency decimals must be an integer between 0 and 3",
    );
  }

  if (
    typeof input.timezone !== "string" ||
    input.timezone.trim().length === 0
  ) {
    throw new BadRequestError("Timezone is required");
  }

  if (
    input.bankAccountNumber !== undefined &&
    input.bankAccountNumber !== null &&
    typeof input.bankAccountNumber !== "string"
  ) {
    throw new BadRequestError(
      "Bank account number must be a string",
    );
  }

  const classItem = await createClass(getDb(env), {
    code: input.code.trim(),
    displayName: input.displayName.trim(),
    currency: input.currency.trim().toUpperCase(),
    currencyDecimals: input.currencyDecimals,
    timezone: input.timezone.trim(),
    bankAccountNumber:
      typeof input.bankAccountNumber === "string"
        ? input.bankAccountNumber.trim() || null
        : null,
  });

  return successResponse(
    {
      class: classItem,
    },
    201,
  );
}
