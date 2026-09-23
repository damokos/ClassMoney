import type { Env } from "../../types/env";
import type { AuthContext } from "../../auth/types";
import { getDb } from "../../db/client";
import {
  listClasses,
  listClassesForUser,
} from "../../db/repositories/classes";
import {
  requireAuthenticatedUser,
  hasGlobalRole,
} from "../../auth/authorization";
import { ForbiddenError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function listClassesHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const includeArchived =
    url.searchParams.get("includeArchived") === "true";

  const user = authContext.user;
  const db = getDb(env);

  if (includeArchived) {
    if (!hasGlobalRole(user, "ADMIN")) {
      throw new ForbiddenError(
        "Only administrators can view archived classes",
      );
    }

    const classes = await listClasses(db, true);

    return successResponse({
      classes,
    });
  }

  if (hasGlobalRole(user, "ADMIN")) {
    const classes = await listClasses(db);

    return successResponse({
      classes,
    });
  }

  const classes = await listClassesForUser(db, user.id);

  return successResponse({
    classes,
  });
}
