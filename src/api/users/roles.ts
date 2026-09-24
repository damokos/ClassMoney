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
