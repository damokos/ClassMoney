import type { AuthContext } from "../auth/types";
import { requireAuthenticatedUser } from "../auth/authorization";
import { getDb } from "../db/client";
import { BadRequestError, NotFoundError } from "../http/errors";
import { successResponse } from "../http/response";
import { getNotificationSettings, listNotificationTypes, listNotifications, saveNotificationSettings } from "../db/repositories/notifications";
import type { Env } from "../types/env";

export async function getNotificationsHandler(_request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  const notifications = await listNotifications(getDb(env), auth.user.id);
  return successResponse({ notifications });
}

export async function getNotificationSettingsHandler(_request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  const db = getDb(env);
  const [settings, types] = await Promise.all([getNotificationSettings(db, auth.user.id), listNotificationTypes(db)]);
  return successResponse({ settings, types, emailConfigured: Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL) });
}

export async function saveNotificationSettingsHandler(request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  let body: unknown;
  try { body = await request.json(); } catch { throw new BadRequestError("Invalid JSON body"); }
  if (!body || typeof body !== "object") throw new BadRequestError("Request body must be an object");
  const input = body as Record<string, unknown>;
  if (typeof input.emailEnabled !== "boolean") throw new BadRequestError("Email enabled must be a boolean");
  if (typeof input.digestTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5](?:0|5)$/.test(input.digestTime)) throw new BadRequestError("Digest time must be in five-minute intervals");
  if (typeof input.timezone !== "string" || input.timezone.length > 100) throw new BadRequestError("Timezone is invalid");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { throw new BadRequestError("Timezone is invalid"); }
  if (!input.preferences || typeof input.preferences !== "object" || Array.isArray(input.preferences)) throw new BadRequestError("Notification preferences must be an object");
  const db = getDb(env);
  const types = await listNotificationTypes(db);
  const validCodes = new Set(types.map((type) => type.code));
  const preferences = input.preferences as Record<string, unknown>;
  for (const [code, value] of Object.entries(preferences)) {
    if (!validCodes.has(code) || typeof value !== "boolean") throw new BadRequestError("Invalid notification preference");
  }
  const current = await getNotificationSettings(db, auth.user.id);
  await saveNotificationSettings(db, auth.user.id, {
    emailEnabled: input.emailEnabled,
    digestTime: input.digestTime,
    timezone: input.timezone,
    preferences: { ...current.preferences, ...preferences } as Record<string, boolean>,
  });
  return successResponse({ saved: true });
}

export async function markNotificationReadHandler(request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  const id = Number(new URL(request.url).pathname.split("/")[3]);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError("Notification not found");
  const result = await getDb(env).prepare(`
    UPDATE notification_events SET read_at = ?
    WHERE id = ? AND user_id = ? AND read_at IS NULL
  `).bind(new Date().toISOString(), id, auth.user.id).run();
  if (!result.meta.changes) {
    const exists = await getDb(env).prepare("SELECT id FROM notification_events WHERE id = ? AND user_id = ?").bind(id, auth.user.id).first<{ id: number }>();
    if (!exists) throw new NotFoundError("Notification not found");
  }
  return successResponse({ saved: true });
}

export async function markAllNotificationsReadHandler(_request: Request, env: Env, auth: AuthContext | null): Promise<Response> {
  requireAuthenticatedUser(auth?.user ?? null);
  await getDb(env).prepare("UPDATE notification_events SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
    .bind(new Date().toISOString(), auth.user.id).run();
  return successResponse({ saved: true });
}
