import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { archiveClass } from "../../db/repositories/classes";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function archiveClassHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const id = Number(parts[parts.length - 2]);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("Class not found");
  }

  const classItem = await archiveClass(getDb(env), id);

  if (!classItem) {
    throw new NotFoundError("Class not found or already archived");
  }

  return successResponse({
    class: classItem,
  });
}
