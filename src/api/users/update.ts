import type { AuthContext } from "../../auth/types";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { deactivateUser, setUserActive } from "../../db/repositories/users";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function updateUserHandler(
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

  if (typeof input.active !== "boolean") {
    throw new BadRequestError("Active must be a boolean");
  }

  let user;

  if (input.active === false) {
    try {
      user = await deactivateUser(
        getDb(env),
        id,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Cannot deactivate the last")
      ) {
        throw new ConflictError(error.message);
      }

      throw error;
    }
  } else {
    user = await setUserActive(
      getDb(env),
      id,
      true,
    );
  }

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return successResponse({
    user,
  });
}
