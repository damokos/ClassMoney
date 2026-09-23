import type { Env } from "./types/env";
import { archiveClassHandler } from "./api/classes/archive";
import { createClassHandler } from "./api/classes/create";
import { getClassHandler } from "./api/classes/get";
import { listClassesHandler } from "./api/classes/list";
import { updateClassHandler } from "./api/classes/update";
import { healthHandler } from "./api/health";
import { NotFoundError } from "./http/errors";
import { errorResponse } from "./http/response";

export async function router(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      return await healthHandler(env);
    }

    if (url.pathname === "/api/classes" && request.method === "GET") {
      return await listClassesHandler(request, env);
    }

    if (url.pathname === "/api/classes" && request.method === "POST") {
      return await createClassHandler(request, env);
    }

    if (
      url.pathname.startsWith("/api/classes/") &&
      request.method === "GET"
    ) {
      return await getClassHandler(request, env);
    }

    if (
      url.pathname.startsWith("/api/classes/") &&
      request.method === "PATCH"
    ) {
      return await updateClassHandler(request, env);
    }

    if (
      url.pathname.startsWith("/api/classes/") &&
      url.pathname.endsWith("/archive") &&
      request.method === "POST"
    ) {
      return await archiveClassHandler(request, env);
    }

    throw new NotFoundError("API endpoint not found");
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(error.code, error.message, error.status);
    }

    console.error("Unhandled API error:", error);

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred",
      500,
    );
  }
}
