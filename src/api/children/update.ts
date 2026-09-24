import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import {
  hasGlobalRole,
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { updateChild } from "../../db/repositories/children";
import {
  BadRequestError,
  NotFoundError,
} from "../../http/errors";
import { successResponse } from "../../http/response";

export async function updateChildHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");

  const classId = Number(parts[3]);
  const childId = Number(parts[5]);

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new NotFoundError("Class not found");
  }

  if (!Number.isInteger(childId) || childId <= 0) {
    throw new NotFoundError("Child not found");
  }

  const user = authContext.user;

  if (!hasGlobalRole(user, "ADMIN")) {
    requireAnyClassRole(
      user,
      classId,
      ["PARENT_REPRESENTATIVE", "TREASURER"],
    );
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

  if (input.name !== undefined) {
    if (
      typeof input.name !== "string" ||
      input.name.trim().length === 0
    ) {
      throw new BadRequestError("Name must not be empty");
    }
  }

  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") {
      throw new BadRequestError("Active must be a boolean");
    }
  }

  const child = await updateChild(
    getDb(env),
    classId,
    childId,
    {
      name:
        typeof input.name === "string"
          ? input.name.trim()
          : undefined,
      active:
        typeof input.active === "boolean"
          ? input.active
          : undefined,
    },
  );

  if (!child) {
    throw new NotFoundError("Child not found");
  }

  return successResponse({
    child,
  });
}
