import type { AuthContext } from "../../auth/types";
import { requireAuthenticatedUser, requireGlobalRole } from "../../auth/authorization";
import { getDb } from "../../db/client";
import { createUserByEmail, getUserByEmail } from "../../db/repositories/users";
import { BadRequestError, ConflictError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function createUserHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be an object");
  }

  const email = (body as Record<string, unknown>).email;
  if (typeof email !== "string") {
    throw new BadRequestError("Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new BadRequestError("A valid email address is required");
  }

  const db = getDb(env);
  if (await getUserByEmail(db, normalizedEmail)) {
    throw new ConflictError("A user with this email already exists");
  }

  try {
    const user = await createUserByEmail(db, normalizedEmail);
    return successResponse({ user }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new ConflictError("A user with this email already exists");
    }
    throw error;
  }
}
