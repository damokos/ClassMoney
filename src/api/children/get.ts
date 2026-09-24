import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import {
  hasGlobalRole,
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { getChildById } from "../../db/repositories/children";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function getChildHandler(
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

  const child = await getChildById(
    getDb(env),
    classId,
    childId,
  );

  if (!child) {
    throw new NotFoundError("Child not found");
  }

  return successResponse({
    child,
  });
}
