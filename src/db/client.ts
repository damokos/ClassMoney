import type { Env } from "../types/env";

export function getDb(env: Env): D1Database {
  return env.DB;
}
