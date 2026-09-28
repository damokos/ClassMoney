import type { Env } from "../types/env";
import { getDb } from "../db/client";
import { getOrCreateUserByEmail } from "../db/repositories/users";
import { getUserRoles } from "../db/repositories/user-roles";
import { getAuthenticatedIdentity } from "./identity";
import type { AuthContext } from "./types";
import { notifyUserCreated } from "../services/notifications";

export async function getAuthContext(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<AuthContext | null> {
  const identity = await getAuthenticatedIdentity(
    request,
    env,
    ctx,
  );

  if (!identity) {
    return null;
  }

  const db = getDb(env);

  const userResult = await getOrCreateUserByEmail(
    db,
    identity.email,
  );

  if (userResult.created && !userResult.initialAdmin) {
    await notifyUserCreated(db, userResult.user);
  }

  const roles = await getUserRoles(db, userResult.user.id);

  return {
    identity,
    user: {
      ...userResult.user,
      roles,
    },
  };
}
