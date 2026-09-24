import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { requireAdminOrClassRole, requireAuthenticatedUser } from "../../auth/authorization";
import { getDb } from "../../db/client";
import { createChild } from "../../db/repositories/children";
import { BadRequestError, NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function createChildHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const classId = Number(parts[3]);

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new NotFoundError("Class not found");
  }

  requireAdminOrClassRole(
    authContext.user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );

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
    typeof input.name !== "string" ||
    input.name.trim().length === 0
  ) {
    throw new BadRequestError("Name is required");
  }

  const child = await createChild(getDb(env), {
    classId,
    name: input.name.trim(),
  });

  return successResponse(
    {
      child,
    },
    201,
  );
}
