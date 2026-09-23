import type { AuthenticatedIdentity } from "./types";

export async function getAuthenticatedIdentity(
  ctx: ExecutionContext,
): Promise<AuthenticatedIdentity | null> {
  if (!ctx.access) {
    return null;
  }

  const identity = await ctx.access.getIdentity();

  if (!identity || typeof identity.email !== "string") {
    return null;
  }

  const email = identity.email.trim().toLowerCase();

  if (!email) {
    return null;
  }

  return {
    email,
  };
}
