import type { AuthContext } from "../../auth/types";
import {
  requireAnyClassRole,
  requireAuthenticatedUser,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { createCharge } from "../../db/repositories/charges";
import { getClassById } from "../../db/repositories/classes";
import { BadRequestError, NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function createChargeHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const classId = Number(
    parts[parts.indexOf("classes") + 1],
  );

  if (!Number.isInteger(classId) || classId <= 0) {
    throw new NotFoundError("Class not found");
  }

  requireAnyClassRole(
    authContext.user,
    classId,
    [
      "PARENT_REPRESENTATIVE",
      "TREASURER",
    ],
  );

  const db = getDb(env);

  const classItem = await getClassById(
    db,
    classId,
  );

  if (!classItem) {
    throw new NotFoundError("Class not found");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new BadRequestError(
      "Invalid JSON body",
    );
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError(
      "Request body must be an object",
    );
  }

  const input = body as Record<string, unknown>;

  if (
    typeof input.childId !== "number" ||
    !Number.isInteger(input.childId) ||
    input.childId <= 0
  ) {
    throw new BadRequestError(
      "Child ID is required",
    );
  }

  if (
    typeof input.title !== "string" ||
    input.title.trim().length === 0
  ) {
    throw new BadRequestError(
      "Title is required",
    );
  }

  if (
    typeof input.amount !== "number" ||
    !Number.isInteger(input.amount) ||
    input.amount <= 0
  ) {
    throw new BadRequestError(
      "Amount must be a positive integer",
    );
  }

  if (
    typeof input.dueDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      input.dueDate,
    )
  ) {
    throw new BadRequestError(
      "Due date must be a valid date",
    );
  }

  const child = await db
    .prepare(`
      SELECT id
      FROM children
      WHERE id = ?
        AND class_id = ?
        AND active = 1
    `)
    .bind(
      input.childId,
      classId,
    )
    .first<{ id: number }>();

  if (!child) {
    throw new BadRequestError(
      "Child not found or inactive",
    );
  }

  const batchId =
    input.batchId === undefined ||
    input.batchId === null
      ? null
      : typeof input.batchId === "number" &&
          Number.isInteger(input.batchId) &&
          input.batchId > 0
        ? input.batchId
        : null;

  const charge = await createCharge(
    db,
    {
      classId,
      childId: input.childId,
      title: input.title.trim(),
      amount: input.amount,
      dueDate: input.dueDate,
      batchId,
    },
    authContext.user.id,
  );

  return successResponse(
    {
      charge,
    },
    201,
  );
}
