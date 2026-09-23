import type { Env } from "../types/env";
import { getDb } from "../db/client";
import { getOrCreateUserByEmail } from "../db/repositories/users";
import { getUserRoles } from "../db/repositories/user-roles";
import { getAuthenticatedIdentity } from "./identity";
import type { AuthContext } from "./types";

export async function getAuthContext(
  env: Env,
  ctx: ExecutionContext,
): Promise<AuthContext | null> {
  const identity = await getAuthenticatedIdentity(ctx);

  if (!identity) {
    return null;
  }

  const db = getDb(env);

  const user = await getOrCreateUserByEmail(
    db,
    identity.email,
  );

  const roles = await getUserRoles(db, user.id);

  return {
    identity,
    user: {
      ...user,
      roles,
    },
  };
}
