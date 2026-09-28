import type { AuthContext, Role } from "../../auth/types";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import {
  addUserRole,
  removeUserRole,
} from "../../db/repositories/user-roles";
import { getUserById } from "../../db/repositories/users";
import { getClassById } from "../../db/repositories/classes";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

const VALID_ROLES: Role[] = [
  "ADMIN",
  "PARENT_REPRESENTATIVE",
  "TREASURER",
];

function parseRoleInput(input: Record<string, unknown>): {
  role: Role;
  classId: number | null;
} {
  if (
    typeof input.role !== "string" ||
    !VALID_ROLES.includes(input.role as Role)
  ) {
    throw new BadRequestError("Invalid role");
  }

  const role = input.role as Role;

  if (role === "ADMIN") {
    if (input.classId !== undefined && input.classId !== null) {
      throw new BadRequestError(
        "ADMIN role cannot have a class",
      );
    }

    return {
      role,
      classId: null,
    };
  }

  if (
    typeof input.classId !== "number" ||
    !Number.isInteger(input.classId) ||
    input.classId <= 0
  ) {
    throw new BadRequestError(
      "Class ID is required for this role",
    );
  }

  return {
    role,
    classId: input.classId,
  };
}

export async function addUserRoleHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const id = Number(url.pathname.split("/")[3]);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("User not found");
  }

  const user = await getUserById(getDb(env), id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be an object");
  }

  const { role, classId } = parseRoleInput(
    body as Record<string, unknown>,
  );

  if (!user.active) {
    throw new ConflictError("Roles cannot be assigned to an inactive user");
  }
  if (classId !== null && !(await getClassById(getDb(env), classId))) {
    throw new BadRequestError("Class not found");
  }

  try {
    const roleAssignment = await addUserRole(
      getDb(env),
      id,
      role,
      classId,
      authContext.user.id,
    );

    return successResponse(
      {
        role: roleAssignment,
      },
      201,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE")
    ) {
      throw new ConflictError("Role is already assigned");
    }

    throw error;
  }
}

export async function removeUserRoleHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const id = Number(url.pathname.split("/")[3]);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("User not found");
  }

  const user = await getUserById(getDb(env), id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be an object");
  }

  const { role, classId } = parseRoleInput(
    body as Record<string, unknown>,
  );

  if (classId !== null && (role === "TREASURER" || role === "PARENT_REPRESENTATIVE")) {
    const counts = await getDb(env).prepare(`
      SELECT
        SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS own_count,
        COUNT(*) AS total_count
      FROM user_roles WHERE class_id = ? AND role = ?
    `).bind(id, classId, role).first<{ own_count: number | null; total_count: number }>();
    if ((counts?.own_count ?? 0) > 0 && counts?.total_count === 1) {
      throw new ConflictError(`Cannot remove the last ${role} for class ${classId}`);
    }
  }

  const removed = await removeUserRole(
    getDb(env),
    id,
    role,
    classId,
  );

  if (!removed) {
    throw new NotFoundError("Role assignment not found");
  }

  return successResponse({
    removed: true,
    role: {
      role,
      classId,
    },
  });
}
