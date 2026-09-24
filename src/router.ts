import type { Env } from "./types/env";
import { archiveClassHandler } from "./api/classes/archive";
import { createClassHandler } from "./api/classes/create";
import { getClassHandler } from "./api/classes/get";
import { listClassesHandler } from "./api/classes/list";
import { updateClassHandler } from "./api/classes/update";
import { healthHandler } from "./api/health";
import { AppError, NotFoundError } from "./http/errors";
import { errorResponse } from "./http/response";
import { getAuthContext } from "./auth/context";
import { listChildrenHandler } from "./api/children/list";
import { createChildHandler } from "./api/children/create";
import { getChildHandler } from "./api/children/get";
import { updateChildHandler } from "./api/children/update";
import { listUsersHandler } from "./api/users/list";
import { getUserHandler } from "./api/users/get";
import { updateUserHandler } from "./api/users/update";
import {
  addUserRoleHandler,
  removeUserRoleHandler,
} from "./api/users/roles";

export async function router(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      return await healthHandler(env);
    }

    const authContext = await getAuthContext(env, ctx);

    if (
      url.pathname.match(/^\/api\/users\/\d+$/) &&
      request.method === "PATCH"
    ) {
      return await updateUserHandler(request, env, authContext);
    }

    if (
      url.pathname.match(/^\/api\/users\/\d+\/roles$/) &&
      request.method === "DELETE"
    ) {
      return await removeUserRoleHandler(
        request,
        env,
        authContext,
      );
    }

    if (
      url.pathname.match(/^\/api\/users\/\d+\/roles$/) &&
      request.method === "POST"
    ) {
      return await addUserRoleHandler(
        request,
        env,
        authContext,
      );
    }

    if (
      url.pathname.match(/^\/api\/users\/\d+$/) &&
      request.method === "GET"
    ) {
      return await getUserHandler(request, env, authContext);
    }

    if (url.pathname === "/api/users" && request.method === "GET") {
      return await listUsersHandler(request, env, authContext);
    }

    if (url.pathname === "/api/classes" && request.method === "GET") {
      return await listClassesHandler(request, env, authContext);
    }

    if (url.pathname === "/api/classes" && request.method === "POST") {
      return await createClassHandler(request, env, authContext);
    }

    if (
      url.pathname.match(/^\/api\/classes\/\d+\/children\/\d+$/) &&
      request.method === "GET"
    ) {
      return await getChildHandler(request, env, authContext);
    }

    if (
      url.pathname.match(/^\/api\/classes\/\d+\/children$/) &&
      request.method === "GET"
    ) {
      return await listChildrenHandler(request, env, authContext);
    }

    if (
      url.pathname.match(/^\/api\/classes\/\d+\/children\/\d+$/) &&
      request.method === "PATCH"
    ) {
      return await updateChildHandler(request, env, authContext);
    }

    if (
      url.pathname.match(/^\/api\/classes\/\d+\/children$/) &&
      request.method === "POST"
    ) {
      return await createChildHandler(request, env, authContext);
    }	
	
    if (
      url.pathname.startsWith("/api/classes/") &&
      request.method === "GET"
    ) {
      return await getClassHandler(request, env, authContext);
    }

    if (
      url.pathname.startsWith("/api/classes/") &&
      request.method === "PATCH"
    ) {
      return await updateClassHandler(request, env, authContext);
    }
    
    if (
      url.pathname.startsWith("/api/classes/") &&
      url.pathname.endsWith("/archive") &&
      request.method === "POST"
    ) {
      return await archiveClassHandler(request, env, authContext);
    }

    throw new NotFoundError("API endpoint not found");
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(
        error.code,
        error.message,
        error.status,
      );
    }

    console.error("Unhandled API error:", error);

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred",
      500,
    );
  }
}
