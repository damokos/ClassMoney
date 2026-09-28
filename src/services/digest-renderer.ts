export interface DigestEvent {
  id: number;
  code: string;
  entityType: string;
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
  return event.code.startsWith("EXPENSE_") ? event.payload.expenseDate : event.payload.dueDate;
}

function eventRow(event: DigestEvent, includeChild: boolean): string {
  const payload = event.payload;
  return `<tr>${includeChild ? `<td>${escapeHtml(payload.childName || "—")}</td>` : ""}<td>${escapeHtml(eventLabel(event))}</td><td>${escapeHtml(payload.className || "—")}</td><td>${escapeHtml(payload.title || payload.description || "—")}</td><td>${escapeHtml(formatMoney(event))}</td><td>${escapeHtml(formatDate(eventDate(event)))}</td></tr>`;
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
  role: "parent" | "szmk" | "treasurer" | "combined";
  recipientName: string | null;
  events: DigestEvent[];
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const { templates, role, recipientName, events, appUrl } = input;
  const title = role === "parent"
    ? `Napi értesítés – ${recipientName || "gyermekeid"} pénzügyeiről`
    : role === "szmk" ? "Napi SZMK összefoglaló"
      : role === "treasurer" ? "Napi pénztárosi összefoglaló"
        : "Napi pénzügyi összefoglaló";
  const intro = role === "parent"
    ? "Az elmúlt napban az alábbi változások történtek a hozzád kapcsolódó gyermekek pénzügyeiben."
    : role === "szmk"
      ? "Az elmúlt napban az alábbi, osztályszintű pénzügyi változások történtek."
      : "Az elmúlt nap pénzügyi értesítései.";
  const content = role === "parent"
    ? renderParentContent(events)
    : `<table><thead><tr><th>Tanuló</th><th>Esemény</th><th>Osztály</th><th>Tétel</th><th>Összeg</th><th>Dátum / határidő</th></tr></thead><tbody>${events.map((event) => eventRow(event, true)).join("")}</tbody></table>`;
  const lines = events.map((event) => {
    const payload = event.payload;
    const child = role === "parent" ? "" : `${typeof payload.childName === "string" ? payload.childName : "—"} | `;
    const className = typeof payload.className === "string" ? payload.className : "—";
    const detail = typeof payload.title === "string" ? payload.title : typeof payload.description === "string" ? payload.description : "—";
    return `${child}${eventLabel(event)} | ${className} | ${detail} | ${formatMoney(event)} | ${formatDate(eventDate(event))}`;
  }).join("\n");
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
