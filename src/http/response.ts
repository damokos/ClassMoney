import { AppError } from "./errors";

export function jsonResponse<T>(
  data: T,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function successResponse<T>(data: T, status = 200): Response {
  return jsonResponse(
    {
      success: true,
      data,
    },
    status,
  );
}

export function errorResponse(error: unknown): Response {
  const appError = error instanceof AppError
    ? error
    : new AppError(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");
  if (!(error instanceof AppError)) console.error("Unhandled API error", error);

  return jsonResponse(
    {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
      },
    },
    appError.status,
  );
}
