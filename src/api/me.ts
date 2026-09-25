import type { AuthContext } from "../auth/types";
import type { Env } from "../types/env";
import {
  requireAuthenticatedUser,
} from "../auth/authorization";
import { successResponse } from "../http/response";

export async function meHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  return successResponse({
    identity: authContext.identity,
    user: authContext.user,
  });
}
