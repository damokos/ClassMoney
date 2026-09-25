import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../types/env";
import type { AuthenticatedIdentity } from "./types";

function getEmailFromIdentity(
  email: unknown,
): AuthenticatedIdentity | null {
  if (typeof email !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  return {
    email: normalizedEmail,
  };
}

export async function getAuthenticatedIdentity(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<AuthenticatedIdentity | null> {
  if (ctx.access) {
    const identity = await ctx.access.getIdentity();

    const authenticatedIdentity = getEmailFromIdentity(
      identity?.email,
    );

    if (authenticatedIdentity) {
      return authenticatedIdentity;
    }
  }

  const token = request.headers.get(
    "CF-Access-Jwt-Assertion",
  );

  if (!token) {
    return null;
  }

  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    throw new Error(
      "Cloudflare Access JWT configuration is missing",
    );
  }

  const issuer = env.TEAM_DOMAIN.replace(/\/+$/, "");

  const jwks = createRemoteJWKSet(
    new URL(`${issuer}/cdn-cgi/access/certs`),
  );

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: env.POLICY_AUD,
  });

  return getEmailFromIdentity(payload.email);
}
