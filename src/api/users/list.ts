import type { AuthContext } from "../../auth/types";
import { requireAuthenticatedUser, requireGlobalRole } from "../../auth/authorization";
import { getDb } from "../../db/client";
import { listAdminUsers } from "../../db/repositories/users";
import type { Env } from "../../types/env";
import { successResponse } from "../../http/response";

export async function listUsersHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const includeInactive =
    url.searchParams.get("includeInactive") === "true";

  const users = await listAdminUsers(
    getDb(env),
    includeInactive,
  );

  return successResponse({
    users,
  });
}
