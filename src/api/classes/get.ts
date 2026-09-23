import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getClassById } from "../../db/repositories/classes";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";

export async function getClassHandler(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("Class not found");
  }

  const classItem = await getClassById(getDb(env), id);

  if (!classItem) {
    throw new NotFoundError("Class not found");
  }

  return successResponse({
    class: classItem,
  });
}
