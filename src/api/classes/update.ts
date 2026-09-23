import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { updateClass } from "../../db/repositories/classes";
import { BadRequestError, NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function updateClassHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("Class not found");
  }

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

  if (input.displayName !== undefined) {
    if (
      typeof input.displayName !== "string" ||
      input.displayName.trim().length === 0
    ) {
      throw new BadRequestError("Display name must not be empty");
    }
  }

  if (input.currency !== undefined) {
    if (
      typeof input.currency !== "string" ||
      input.currency.trim().length !== 3
    ) {
      throw new BadRequestError("Currency must be a 3-letter code");
    }
  }

  if (input.currencyDecimals !== undefined) {
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
  }

  if (input.timezone !== undefined) {
    if (
      typeof input.timezone !== "string" ||
      input.timezone.trim().length === 0
    ) {
      throw new BadRequestError("Timezone must not be empty");
    }
  }

  const classItem = await updateClass(getDb(env), id, {
    displayName:
      typeof input.displayName === "string"
        ? input.displayName.trim()
        : undefined,
    currency:
      typeof input.currency === "string"
        ? input.currency.trim().toUpperCase()
        : undefined,
    currencyDecimals:
      typeof input.currencyDecimals === "number"
        ? input.currencyDecimals
        : undefined,
    timezone:
      typeof input.timezone === "string"
        ? input.timezone.trim()
        : undefined,
  });

  if (!classItem) {
    throw new NotFoundError("Class not found");
  }

  return successResponse({
    class: classItem,
  });
}
