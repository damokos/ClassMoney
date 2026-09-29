import type { AuthContext } from "../../auth/types";
import { requireAuthenticatedUser, requireGlobalRole } from "../../auth/authorization";
import { getDb } from "../../db/client";
import { getInstitutionName, setInstitutionName } from "../../db/repositories/app-settings";
import { BadRequestError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function getInstitutionNameHandler(
  _request: Request,
  env: Env,
  auth: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  const name = await getInstitutionName(getDb(env));
  return successResponse({ name });
}

export async function setInstitutionNameHandler(
  request: Request,
  env: Env,
  auth: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  requireGlobalRole(auth.user, "ADMIN");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be an object");
  }

  const rawName = (body as Record<string, unknown>).name;
  if (typeof rawName !== "string") {
    throw new BadRequestError("Institution name must be a string");
  }
  const name = rawName.trim();
  if (name.length > 120) {
    throw new BadRequestError("Institution name must not exceed 120 characters");
  }

  await setInstitutionName(getDb(env), name, auth.user.id);
  return successResponse({ name });
}
