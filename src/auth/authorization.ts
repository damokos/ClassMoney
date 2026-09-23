import type { AuthenticatedUser, Role } from "./types";
import {
  ForbiddenError,
  UnauthorizedError,
} from "../http/errors";

export function requireAuthenticatedUser(
  user: AuthenticatedUser | null,
): asserts user is AuthenticatedUser {
  if (!user) {
    throw new UnauthorizedError();
  }

  if (!user.active) {
    throw new ForbiddenError("User account is inactive");
  }
}

export function hasGlobalRole(
  user: AuthenticatedUser,
  role: Role,
): boolean {
  return user.roles.some(
    (assignment) =>
      assignment.role === role &&
      assignment.classId === null,
  );
}

export function hasClassRole(
  user: AuthenticatedUser,
  classId: number,
  role: Role,
): boolean {
  return user.roles.some(
    (assignment) =>
      assignment.role === role &&
      assignment.classId === classId,
  );
}

export function requireGlobalRole(
  user: AuthenticatedUser,
  role: Role,
): void {
  if (!hasGlobalRole(user, role)) {
    throw new ForbiddenError("Required global role is missing");
  }
}

export function requireClassRole(
  user: AuthenticatedUser,
  classId: number,
  role: Role,
): void {
  if (!hasClassRole(user, classId, role)) {
    throw new ForbiddenError("Required class role is missing");
  }
}

export function requireAnyClassRole(
  user: AuthenticatedUser,
  classId: number,
  roles: Role[],
): void {
  const hasRole = roles.some((role) =>
    hasClassRole(user, classId, role),
  );

  if (!hasRole) {
    throw new ForbiddenError("Required class role is missing");
  }
}

export function requireAdminOrClassRole(
  user: AuthenticatedUser,
  classId: number,
  roles: Role[],
): void {
  if (hasGlobalRole(user, "ADMIN")) {
    return;
  }

  requireAnyClassRole(user, classId, roles);
}

export function requireTreasurer(
  user: AuthenticatedUser,
  classId: number,
): void {
  requireClassRole(user, classId, "TREASURER");
}

export function requireAuditAccess(
  user: AuthenticatedUser,
  classId?: number,
): void {
  if (hasGlobalRole(user, "ADMIN")) {
    return;
  }

  if (classId === undefined) {
    throw new ForbiddenError("Class scope is required");
  }

  requireAnyClassRole(
    user,
    classId,
    ["PARENT_REPRESENTATIVE", "TREASURER"],
  );
}
