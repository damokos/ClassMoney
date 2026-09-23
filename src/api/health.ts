import type { Env } from "../types/env";
import { getDb } from "../db/client";
import { successResponse } from "../http/response";

export async function healthHandler(env: Env): Promise<Response> {
  const db = getDb(env);

  const result = await db
    .prepare("SELECT 1 AS ok")
    .first<{ ok: number }>();

  return successResponse({
    status: "ok",
    database: result?.ok === 1 ? "ok" : "error",
    timestamp: new Date().toISOString(),
  });
}
