import type { AuthContext } from "../../auth/types";
import type { Env } from "../../types/env";
import { getDb } from "../../db/client";
import { getChargeById } from "../../db/repositories/charges";
import {
  requireAuthenticatedUser,
  requireTreasurer,
} from "../../auth/authorization";
import { NotFoundError } from "../../http/errors";
import { successResponse } from "../../http/response";
import { payCharge } from "../../services/charges";
import { notifyChargePaid } from "../../services/notifications";
import { getClassById } from "../../db/repositories/classes";
import { requireActiveClass } from "../../services/class-state";

export async function payChargeHandler(
  request: Request,
  env: Env,
  authContext: AuthContext | null,
): Promise<Response> {
  requireAuthenticatedUser(authContext?.user ?? null);

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/api\/charges\/(\d+)\/pay$/,
  );

  if (!match) {
    throw new NotFoundError("Charge not found");
  }

  const id = Number(match[1]);

  const db = getDb(env);

  const charge = await getChargeById(db, id);

  if (!charge) {
    throw new NotFoundError("Charge not found");
  }

  requireTreasurer(
    authContext.user,
    charge.classId,
  );
  requireActiveClass(await getClassById(db, charge.classId));

  const paidCharge = await payCharge(
    db,
    charge.id,
    authContext.user.id,
  );

  await notifyChargePaid(db, paidCharge);

  return successResponse({
    charge: paidCharge,
  });
}
