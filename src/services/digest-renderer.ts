export interface DigestEvent {
  id: number;
  code: string;
  entityType: string;
  entityId: number | null;
  classId: number | null;
  payload: Record<string, unknown>;
}

export interface DigestTemplates {
  html: string;
  text: string;
}

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character] ?? character);

function eventAction(event: DigestEvent): string {
  if (event.entityType === "charge_due_soon") return "due_soon";
  if (event.entityType === "charge_cancelled" || event.entityType === "expense_cancelled") return "cancelled";
  if (event.entityType === "charge_paid" || event.entityType === "expense_paid") return "marked_paid";
  if (event.code === "CHARGE_MARKED_PAID") return "marked_paid";
  if (event.code === "CHARGE_DUE_SOON") return "due_soon";
  if (event.code === "EXPENSE_CANCELLED") return "cancelled";
  return "created";
}

function eventLabel(event: DigestEvent): string {
  const action = eventAction(event);
  const labels: Record<string, Record<string, string>> = {
    USER_CREATED: { created: "Új felhasználó lépett be" },
    CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD: { created: "Új fizetendő tétel", cancelled: "Fizetendő tételt töröltek" },
    CHARGE_ASSIGNED_OR_CANCELLED: { created: "Új fizetendő tétel", cancelled: "Fizetendő tételt töröltek" },
    CHARGE_MARKED_PAID: { marked_paid: "Tételt kiegyenlítettnek jelöltek" },
    CHARGE_DUE_SOON: { due_soon: "Közelgő fizetési határidő" },
    EXPENSE_CREATED: { created: "Új kiadás került rögzítésre" },
    EXPENSE_CANCELLED: { cancelled: "Kiadást érvénytelenítettek" },
    EXPENSE_MARKED_PAID: { marked_paid: "Kiadást kifizetettnek jelöltek" },
  };
  return labels[event.code]?.[action] ?? "Pénzügyi változás";
}

function formatMoney(event: DigestEvent): string {
  const amount = event.payload.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  const currency = typeof event.payload.currency === "string" ? event.payload.currency : "HUF";
  const decimals = typeof event.payload.currencyDecimals === "number" ? event.payload.currencyDecimals : 0;
  try {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency", currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount / 10 ** decimals);
  } catch {
    return `${new Intl.NumberFormat("hu-HU").format(amount)} ${currency}`;
  }
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  return new Intl.DateTimeFormat("hu-HU").format(new Date(`${value}T12:00:00Z`));
}

function eventDate(event: DigestEvent): unknown {
  if (event.code === "USER_CREATED" && typeof event.payload.createdAt === "string") {
    return event.payload.createdAt.slice(0, 10);
  }
  return event.code.startsWith("EXPENSE_") ? event.payload.expenseDate : event.payload.dueDate;
}

function eventRow(event: DigestEvent, includeChild: boolean): string {
  const payload = event.payload;
  const person = payload.childName || payload.email || "—";
  const detail = event.code === "USER_CREATED" ? "Első belépés" : payload.title || payload.description || "—";
  return `<tr>${includeChild ? `<td>${escapeHtml(person)}</td>` : ""}<td>${escapeHtml(eventLabel(event))}</td><td>${escapeHtml(payload.className || "—")}</td><td>${escapeHtml(detail)}</td><td>${escapeHtml(formatMoney(event))}</td><td>${escapeHtml(formatDate(eventDate(event)))}</td></tr>`;
}

function renderParentContent(events: DigestEvent[]): string {
  const groups = new Map<string, DigestEvent[]>();
  for (const event of events) {
    const name = typeof event.payload.childName === "string" ? event.payload.childName : "Gyermek";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(event);
  }
  return [...groups.entries()].map(([name, rows]) => `<section class="child-section"><h2>${escapeHtml(name)}</h2><table><thead><tr><th>Esemény</th><th>Osztály</th><th>Tétel</th><th>Összeg</th><th>Dátum / határidő</th></tr></thead><tbody>${rows.map((event) => eventRow(event, false)).join("")}</tbody></table></section>`).join("");
}

function renderRoleTable(events: DigestEvent[], heading: string, role: string): string {
  if (!events.length) return "";
  return `<section class="child-section"><h2>${escapeHtml(heading)}</h2><table><thead><tr><th>${role === "admin" ? "Felhasználó / tanuló" : "Tanuló"}</th><th>Esemény</th><th>Osztály</th><th>Tétel</th><th>Összeg</th><th>Dátum / határidő</th></tr></thead><tbody>${events.map((event) => eventRow(event, true)).join("")}</tbody></table></section>`;
}

export async function loadDigestTemplates(assets: Fetcher): Promise<DigestTemplates> {
  const [htmlResponse, textResponse] = await Promise.all([
    assets.fetch(new Request("https://assets.local/email/digest.html")),
    assets.fetch(new Request("https://assets.local/email/digest.txt")),
  ]);
  if (!htmlResponse.ok || !textResponse.ok) throw new Error("Email template nem található.");
  return { html: await htmlResponse.text(), text: await textResponse.text() };
}

export function renderDigest(input: {
  templates: DigestTemplates;
  role: "parent" | "szmk" | "treasurer" | "combined" | "admin";
  recipientName: string | null;
  events: DigestEvent[];
  ownChildIds: number[];
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const { templates, role, recipientName, appUrl } = input;
  const uniqueEvents = new Map<string, DigestEvent>();
  for (const event of input.events) {
    const isOverlappingChargeNotice = event.entityId !== null && (
      event.code === "CHARGE_ASSIGNED_OR_CANCELLED_FOR_MY_CHILD"
      || event.code === "CHARGE_ASSIGNED_OR_CANCELLED"
    );
    const key = isOverlappingChargeNotice
      ? `charge:${event.classId}:${event.entityType}:${event.entityId}`
      : `event:${event.id}`;
    const previous = uniqueEvents.get(key);
    if (!previous || event.code === "CHARGE_ASSIGNED_OR_CANCELLED") uniqueEvents.set(key, event);
  }
  const events = [...uniqueEvents.values()];
  const ownChildIds = new Set(input.ownChildIds);
  const title = role === "parent"
    ? `Napi értesítés – ${recipientName || "gyermekeid"} pénzügyeiről`
    : role === "szmk" ? "Napi SZMK összefoglaló"
    : role === "treasurer" ? "Napi pénztárosi összefoglaló"
        : role === "admin" ? "Napi adminisztrátori összefoglaló"
          : "Napi pénzügyi összefoglaló";
  const intro = role === "parent"
    ? "Az elmúlt napban az alábbi változások történtek a hozzád kapcsolódó gyermekek pénzügyeiben."
    : role === "szmk"
      ? "Az elmúlt napban az alábbi, osztályszintű pénzügyi változások történtek."
      : role === "admin"
        ? "Az elmúlt nap új felhasználói és pénzügyi eseményei."
      : "Az elmúlt nap pénzügyi értesítései.";
  const ownChildEvents = role === "parent" ? [] : events.filter((event) => {
    const childId = event.payload.childId;
    return typeof childId === "number" && ownChildIds.has(childId);
  });
  const roleEvents = role === "parent" ? events : events.filter((event) => !ownChildEvents.includes(event));
  const content = role === "parent"
    ? renderParentContent(events)
    : `${renderRoleTable(ownChildEvents, "Saját gyermekeidet érintő események", role)}${renderRoleTable(roleEvents, "További osztályszintű események", role)}`;
  const renderTextLines = (rows: DigestEvent[]) => rows.map((event) => {
    const payload = event.payload;
    const child = role === "parent" ? "" : `${typeof payload.childName === "string" ? payload.childName : typeof payload.email === "string" ? payload.email : "—"} | `;
    const className = typeof payload.className === "string" ? payload.className : "—";
    const detail = event.code === "USER_CREATED" ? "Első belépés" : typeof payload.title === "string" ? payload.title : typeof payload.description === "string" ? payload.description : "—";
    return `${child}${eventLabel(event)} | ${className} | ${detail} | ${formatMoney(event)} | ${formatDate(eventDate(event))}`;
  }).join("\n");
  const lines = role === "parent"
    ? renderTextLines(events)
    : [
        ownChildEvents.length ? `Saját gyermekeidet érintő események:\n${renderTextLines(ownChildEvents)}` : "",
        roleEvents.length ? `További osztályszintű események:\n${renderTextLines(roleEvents)}` : "",
      ].filter(Boolean).join("\n\n");
  let html = templates.html
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{INTRO}}", escapeHtml(intro))
    .replaceAll("{{CONTENT}}", content)
    .replaceAll("{{APP_URL}}", escapeHtml(appUrl ?? ""));
  let text = templates.text
    .replaceAll("{{TITLE}}", title)
    .replaceAll("{{INTRO}}", intro)
    .replaceAll("{{CONTENT}}", lines)
    .replaceAll("{{APP_URL}}", appUrl ?? "");
  if (!appUrl) {
    html = html.replace(/<a class="button" href="">.*?<\/a>/s, "");
    text = text.replace(/\nClassMoney:\n\n/, "");
  }
  return { subject: title, html, text };
}
