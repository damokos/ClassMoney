import type { Env } from "./types/env";
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
