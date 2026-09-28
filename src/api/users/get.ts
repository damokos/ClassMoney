import type { AuthContext } from "../../auth/types";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
} from "../../auth/authorization";
import { getDb } from "../../db/client";
import { getUserById } from "../../db/repositories/users";
import { getUserRoles } from "../../db/repositories/user-roles";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import type { Env } from "../../types/env";

export async function getUserHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);
  requireGlobalRole(authContext.user, "ADMIN");

  const url = new URL(request.url);
  const id = Number(url.pathname.split("/").pop());

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError("User not found");
  }

  const db = getDb(env);
  const user = await getUserById(db, id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const roles = await getUserRoles(db, id);
  const children = await db.prepare(`
    SELECT children.id, children.name, children.class_id AS classId,
      classes.display_name AS className
    FROM user_children
    INNER JOIN children ON children.id = user_children.child_id
    INNER JOIN classes ON classes.id = children.class_id
    WHERE user_children.user_id = ?
    ORDER BY classes.display_name COLLATE NOCASE, children.name COLLATE NOCASE
  `).bind(id).all<{ id: number; name: string; classId: number; className: string }>();
  return successResponse({ user: { ...user, roles, children: children.results } });
}
