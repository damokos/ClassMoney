import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getClassById } from "../../db/repositories/classes";
import {
  hasGlobalRole,
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import {
  ForbiddenError,
  NotFoundError,
} from "../../http/errors";
import { successResponse } from "../../http/response";

export async function getClassHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("Class not found");
  }

  const classItem = await getClassById(getDb(env), id);

  if (!classItem) {
    throw new NotFoundError("Class not found");
  }

  const user = authContext.user;
  const isAdmin = hasGlobalRole(user, "ADMIN");

  if (!isAdmin) {
    if (!classItem.active) {
      throw new ForbiddenError(
        "Only administrators can view archived classes",
      );
    }

    requireAnyClassRole(
      user,
      id,
      ["PARENT_REPRESENTATIVE", "TREASURER"],
    );
  }

  return successResponse({
    class: classItem,
  });
}
