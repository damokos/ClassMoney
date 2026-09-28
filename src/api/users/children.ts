import type { AuthContext } from "../../auth/types";
import { requireAuthenticatedUser, requireGlobalRole } from "../../auth/authorization";
import { getDb } from "../../db/client";
import { setUserChildren, getUserById } from "../../db/repositories/users";
import { BadRequestError, NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function updateUserChildrenHandler(request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  requireGlobalRole(auth.user, "ADMIN");
  const id = Number(new URL(request.url).pathname.split("/")[3]);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError("User not found");
  const db = getDb(env);
  const user = await getUserById(db, id);
  if (!user) throw new NotFoundError("User not found");
  let body: unknown;
  try { body = await request.json(); } catch { throw new BadRequestError("Invalid JSON body"); }
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).childIds)) throw new BadRequestError("Child IDs must be an array");
  const childIds = (body as { childIds: unknown[] }).childIds;
  if (!childIds.every((value) => Number.isInteger(value) && Number(value) > 0)) throw new BadRequestError("Child IDs must be positive integers");
  try { await setUserChildren(db, id, childIds as number[]); }
  catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate")) throw new BadRequestError(error.message);
    if (error instanceof Error && error.message.includes("unavailable")) throw new BadRequestError(error.message);
    throw error;
  }
  return successResponse({ saved: true });
}
