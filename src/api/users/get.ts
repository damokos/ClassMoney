import type { AuthContext } from "../../auth/types";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { getUserById } from "../../db/repositories/users";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function getUserHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("User not found");
  }

  const user = await getUserById(getDb(env), id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return successResponse({
    user,
  });
}
