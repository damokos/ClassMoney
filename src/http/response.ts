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

export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return jsonResponse(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    status,
  );
}
