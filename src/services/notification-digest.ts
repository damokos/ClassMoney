import { createNotificationEvents } from "../db/repositories/notifications";
import { loadDigestTemplates, renderDigest } from "./digest-renderer";
import type { Env } from "../types/env";

function localClock(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

async function createDueSoonEvents(env: Env): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const charges = await env.DB.prepare(`
    SELECT ch.id, ch.class_id, ch.child_id, ch.title, ch.due_date,
      ch.amount, c.name AS child_name, cl.display_name AS class_name,
      cl.currency, cl.currency_decimals
    FROM charges ch
    INNER JOIN children c ON c.id = ch.child_id
    INNER JOIN classes cl ON cl.id = ch.class_id
    WHERE ch.status = 'PENDING' AND ch.due_date >= ? AND ch.due_date <= ?
  `).bind(today, end).all<{ id: number; class_id: number; child_id: number; title: string; due_date: string; amount: number; child_name: string; class_name: string; currency: string; currency_decimals: number }>();
  await Promise.all(charges.results.map((charge) => createNotificationEvents(
    env.DB,
    "CHARGE_DUE_SOON",
    charge.class_id,
    "charge_due_soon",
    charge.id,
    { title: charge.title, dueDate: charge.due_date, childId: charge.child_id, childName: charge.child_name, className: charge.class_name, currency: charge.currency, currencyDecimals: charge.currency_decimals, amount: charge.amount },
    charge.child_id,
  ).catch((error) => console.error("Unable to create due-soon notification", charge.id, error))));
}

async function sendUserDigest(env: Env, user: { id: number; email: string; digest_time: string; timezone: string }, currentTime: Date): Promise<void> {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return;
  const senderEmail = env.BREVO_SENDER_EMAIL;
  if (!senderEmail) return;
  let clock: string;
  try { clock = localClock(currentTime, user.timezone); }
  catch (error) { console.error("Invalid digest timezone", user.id, error); return; }
  if (clock !== user.digest_time) return;
  const events = await env.DB.prepare(`
    SELECT e.id, t.code, e.class_id AS classId, e.entity_type AS entityType, e.payload
    FROM notification_events e
    INNER JOIN notification_types t ON t.id = e.notification_type_id
    LEFT JOIN notification_preferences p
      ON p.user_id = e.user_id AND p.notification_type_id = e.notification_type_id
    WHERE e.user_id = ? AND e.status IN ('PENDING', 'FAILED')
      AND (e.delivery_claimed_at IS NULL OR e.delivery_claimed_at < ?)
      AND COALESCE(p.enabled, 1) = 1
    ORDER BY e.created_at, e.id
    LIMIT 100
  `).bind(user.id, new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString())
    .all<{ id: number; code: string; classId: number | null; entityType: string | null; payload: string | null }>();
  if (!events.results.length) return;
  const claimedEvents: typeof events.results = [];
  const claimedAt = currentTime.toISOString();
  const staleBefore = new Date(currentTime.getTime() - 30 * 60 * 1000).toISOString();
  for (const event of events.results) {
    const claim = await env.DB.prepare(`
      UPDATE notification_events
      SET delivery_claimed_at = ?
      WHERE id = ? AND user_id = ? AND status IN ('PENDING', 'FAILED')
        AND (delivery_claimed_at IS NULL OR delivery_claimed_at < ?)
    `).bind(claimedAt, event.id, user.id, staleBefore).run();
    if ((claim.meta?.changes ?? 0) > 0) claimedEvents.push(event);
  }
  if (!claimedEvents.length) return;
  const assignedRoles = await env.DB.prepare("SELECT role, class_id FROM user_roles WHERE user_id = ?").bind(user.id)
    .all<{ role: string; class_id: number | null }>();
  const isGlobalAdmin = assignedRoles.results.some((assignment) => assignment.role === "ADMIN" && assignment.class_id === null);
  const claimedDigestEvents = claimedEvents.map((event) => ({
    id: event.id,
    code: event.code,
    classId: event.classId,
    entityType: event.entityType ?? "",
    payload: event.payload ? JSON.parse(event.payload) as Record<string, unknown> : {},
  }));
  const hasNewUsers = claimedDigestEvents.some((event) => event.code === "USER_CREATED");
  const relevantRoles = new Set(assignedRoles.results
    .filter((assignment) => assignment.class_id !== null && claimedDigestEvents.some((event) => event.classId === assignment.class_id))
    .map((assignment) => assignment.role));
  const role = isGlobalAdmin && hasNewUsers
    ? "admin"
    : relevantRoles.has("TREASURER") && relevantRoles.has("PARENT_REPRESENTATIVE")
    ? "combined"
    : relevantRoles.has("TREASURER") ? "treasurer"
      : relevantRoles.has("PARENT_REPRESENTATIVE") ? "szmk" : "parent";
  const childNames = [...new Set(claimedDigestEvents.map((event) => event.payload.childName)
    .filter((name): name is string => typeof name === "string"))];
  const rawRecipientName = childNames.length === 1 ? childNames[0] : childNames.length > 1 ? "gyermekeid" : null;
  const recipientName = rawRecipientName?.replace(/[\r\n]+/g, " ").slice(0, 80) ?? null;
  const templates = await loadDigestTemplates(env.ASSETS);
  const digest = renderDigest({ templates, role, recipientName, events: claimedDigestEvents, appUrl: env.APP_URL });
  const now = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: env.BREVO_SENDER_NAME || "ClassMoney" },
          to: [{ email: user.email, ...(recipientName ? { name: recipientName } : {}) }],
          subject: digest.subject,
          textContent: digest.text,
          htmlContent: digest.html,
          trackClicks: false,
          tags: ["classmoney-digest"],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const details = (await response.text()).slice(0, 400);
      throw new Error(`Brevo API returned ${response.status}: ${details}`);
    }
    await env.DB.batch(claimedEvents.map((event) => env.DB.prepare(`
      UPDATE notification_events SET status = 'SENT', sent_at = ?, failed_at = NULL, error_message = NULL,
        delivery_claimed_at = NULL
      WHERE id = ? AND user_id = ? AND delivery_claimed_at = ?
    `).bind(now, event.id, user.id, claimedAt)));
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 500);
    console.error("Notification digest delivery failed", user.id, message);
    await env.DB.batch(claimedEvents.map((event) => env.DB.prepare(`
      UPDATE notification_events SET status = 'FAILED', failed_at = ?, error_message = ?,
        delivery_claimed_at = NULL
      WHERE id = ? AND user_id = ? AND delivery_claimed_at = ?
    `).bind(now, message, event.id, user.id, claimedAt)));
  }
}

export async function runNotificationDigest(env: Env, currentTime = new Date()): Promise<void> {
  await createDueSoonEvents(env);
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) return;
  const users = await env.DB.prepare(`
    SELECT u.id, u.email,
      COALESCE(s.digest_time, '08:00') AS digest_time,
      COALESCE(s.timezone, 'Europe/Budapest') AS timezone
    FROM users u
    LEFT JOIN notification_settings s ON s.user_id = u.id
    WHERE COALESCE(s.email_enabled, 1) = 1 AND u.active = 1
  `).all<{ id: number; email: string; digest_time: string; timezone: string }>();
  await Promise.all(users.results.map((user) => sendUserDigest(env, user, currentTime).catch((error) => {
    console.error("Unable to process notification digest", user.id, error);
  })));
}
