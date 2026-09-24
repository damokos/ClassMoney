import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { listChildren } from "../../db/repositories/children";
import {
  hasGlobalRole,
  requireAuthenticatedUser,
  requireAnyClassRole,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function listChildrenHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const classId = Number(parts[parts.indexOf("classes") + 1]);

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new NotFoundError("Class not found");
  }

  const user = authContext.user;

  if (!hasGlobalRole(user, "ADMIN")) {
    requireAnyClassRole(
      user,
      classId,
      ["PARENT_REPRESENTATIVE", "TREASURER"],
    );
  }

  const includeInactive =
    url.searchParams.get("includeInactive") === "true";

  const children = await listChildren(
    getDb(env),
    classId,
    includeInactive,
  );

  return successResponse({
    children,
  });
}
