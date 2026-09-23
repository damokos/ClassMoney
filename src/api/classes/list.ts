import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { listClasses } from "../../db/repositories/classes";
import { successResponse } from "../../http/response";

export async function listClassesHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  const classes = await listClasses(
    getDb(env),
    includeArchived,
  );

  return successResponse({
    classes,
  });
}
