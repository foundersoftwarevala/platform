import { rest as serviceRest } from "@/lib/affiliate/core";
import { APPLICATION_KINDS, listApplications } from "@/lib/applications/registry.server";

import type { FeedAlertSource, FeedItem } from "./feed";

/**
 * The Control Panel banner's items, read from the platform.
 *
 * The banner used to carry six sentences typed into the page - a ₹8,42,000
 * payout, a 91% server load on a cluster that does not exist, 142 leads - and
 * its buttons only removed them from the screen and said "Approved". Each item
 * here is a real row, and each action changes that row:
 *
 *   approval      an open role application; approving it is the application's
 *                 own decision, made through the applications API
 *   alert         an open critical or high alert raised by a module; to
 *                 acknowledge it is to mark it acknowledged in that module
 *   todo          an open task assigned to the person looking
 *   notification  what arrived today, counted
 */

type Row = Record<string, unknown>;
const text = (v: unknown) => (v == null ? "" : String(v));

/**
 * Each module that raises alerts: where its open alerts are, how to read one,
 * and what acknowledging one writes - the same change that module's own screen
 * makes, so an alert acknowledged here reads as acknowledged there.
 */
export const ALERT_SOURCES: Record<
  FeedAlertSource,
  {
    table: string;
    module: string;
    href: string;
    select: string;
    /** The column each module dates its alerts by. */
    order: string;
    open: string;
    title: (r: Row) => string;
    detail: (r: Row) => string;
    acknowledge: () => Row;
  }
> = {
  server_alerts: {
    table: "server_alerts",
    module: "Server Manager",
    href: "/server-manager",
    select: "id,severity,message,alert_type,category,created_at",
    order: "created_at",
    open: "is_resolved=is.false&resolved_at=is.null&acknowledged_at=is.null",
    title: (r) => text(r.alert_type || r.category || "Server alert"),
    detail: (r) => text(r.message),
    acknowledge: () => ({ acknowledged_at: new Date().toISOString() }),
  },
  security_alerts: {
    table: "security_alerts",
    module: "Security",
    href: "/manager/security",
    select: "id,severity,title,description,created_at:detected_at",
    order: "detected_at",
    open: "status=eq.open&resolved_at=is.null",
    title: (r) => text(r.title),
    detail: (r) => text(r.description),
    acknowledge: () => ({ status: "acknowledged" }),
  },
  finance_alerts: {
    table: "finance_alerts",
    module: "Finance Manager",
    href: "/finance-manager",
    select: "id,severity,title,message,created_at",
    order: "created_at",
    open: "status=in.(unread,read,open)",
    title: (r) => text(r.title),
    detail: (r) => text(r.message),
    acknowledge: () => ({ status: "acknowledged" }),
  },
  legal_alerts: {
    table: "legal_alerts",
    module: "Legal Manager",
    href: "/legal-manager",
    select: "id,severity,title,description,created_at:detected_at",
    order: "detected_at",
    open: "status=eq.pending",
    title: (r) => text(r.title),
    detail: (r) => text(r.description),
    acknowledge: () => ({ status: "reviewed" }),
  },
  lead_alerts: {
    table: "lead_alerts",
    module: "Lead Manager",
    href: "/lead-manager",
    select: "id,severity,alert_type,message,created_at",
    order: "created_at",
    open: "is_active=is.true",
    title: (r) => text(r.alert_type).replace(/_/g, " ") || "Lead alert",
    detail: (r) => text(r.message),
    acknowledge: () => ({ is_active: false, acknowledged_at: new Date().toISOString() }),
  },
  seo_alerts: {
    table: "seo_alerts",
    module: "SEO Manager",
    href: "/seo-manager",
    select: "id,severity,title,message,created_at",
    order: "created_at",
    open: "acknowledged=is.false",
    title: (r) => text(r.title),
    detail: (r) => text(r.message),
    acknowledge: () => ({ acknowledged: true }),
  },
  marketing_alerts: {
    table: "marketing_alerts",
    module: "Marketing",
    href: "/marketing",
    select: "id,severity,title,message,created_at",
    order: "created_at",
    // Rows the marketing module seeded for its own demonstration are not alerts.
    open: "status=eq.open&resolved_at=is.null&is_seed=is.false",
    title: (r) => text(r.title),
    detail: (r) => text(r.message),
    acknowledge: () => ({ status: "acknowledged" }),
  },
};

export function isAlertSource(value: unknown): value is FeedAlertSource {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ALERT_SOURCES, value);
}

const KIND_LABEL: Record<string, string> = {
  reseller: "Reseller",
  vendor: "Vendor",
  author: "Author",
  franchise: "Franchise",
  influencer: "Influencer",
  affiliate: "Affiliate",
};

async function read(path: string): Promise<Row[]> {
  const response = await serviceRest(path);
  if (!response.ok) throw new Error(`${path.split("?")[0]} could not be read (${response.status})`);
  return (await response.json()) as Row[];
}

async function count(path: string): Promise<number> {
  const response = await serviceRest(path, {
    method: "HEAD",
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) throw new Error(`${path.split("?")[0]} could not be counted (${response.status})`);
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

/** IST midnight, the business day. */
function startOfToday(): string {
  const ist = new Date(Date.now() + 330 * 60_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60_000).toISOString();
}

export async function loadFeed(userId: string): Promise<{ items: FeedItem[]; unavailable: string[] }> {
  const unavailable: string[] = [];
  const guard = async <T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      console.error(`[control-panel feed] ${label}`, error);
      unavailable.push(label);
      return fallback;
    }
  };

  const [applications, alerts, tasks, leadsToday, ordersToday] = await Promise.all([
    guard("Applications", () => listApplications([...APPLICATION_KINDS], true), []),
    Promise.all(
      (Object.keys(ALERT_SOURCES) as FeedAlertSource[]).map((source) => {
        const s = ALERT_SOURCES[source];
        return guard(
          s.module,
          async () =>
            (
              await read(
                `${s.table}?select=${s.select}&${s.open}&severity=in.(critical,high)&order=${s.order}.desc&limit=5`,
              )
            ).map((r) => ({ source, row: r })),
          [] as { source: FeedAlertSource; row: Row }[],
        );
      }),
    ).then((groups) => groups.flat()),
    guard(
      "Task Manager",
      () =>
        read(
          `tm_tasks?select=id,code,title,deadline,priority,status&assigned_to=eq.${encodeURIComponent(userId)}` +
            `&status=not.in.(approved,rejected,completed,cancelled,failed,closed)&order=deadline.asc.nullslast&limit=5`,
        ),
      [] as Row[],
    ),
    guard("Leads", () => count(`leads?select=id&created_at=gte.${startOfToday()}`), 0),
    guard("Orders", () => count(`marketplace_orders?select=id&status=eq.paid&created_at=gte.${startOfToday()}`), 0),
  ]);

  const items: FeedItem[] = [];

  for (const { source, row } of alerts) {
    const s = ALERT_SOURCES[source];
    items.push({
      id: `alert:${source}:${text(row.id)}`,
      kind: "alert",
      title: s.title(row) || "Alert",
      detail: s.detail(row),
      meta: `${s.module} • ${text(row.severity)}`,
      at: text(row.created_at) || null,
      href: s.href,
      action: { type: "acknowledge", source, id: text(row.id) },
    });
  }

  for (const a of applications.slice(0, 10)) {
    items.push({
      id: `approval:${a.kind}:${a.id}`,
      kind: "approval",
      title: `${KIND_LABEL[a.kind] ?? a.kind} application — ${a.name || a.email || a.number}`,
      detail: `${a.number} · ${a.status.replace(/_/g, " ")}${a.email ? ` · ${a.email}` : ""}`,
      meta: "Application Manager",
      at: a.submitted || null,
      href: "/application-manager",
      action: a.actions.includes("approved")
        ? { type: "approve", kind: a.kind, id: a.id }
        : { type: "open" },
    });
  }

  for (const t of tasks) {
    items.push({
      id: `todo:${text(t.id)}`,
      kind: "todo",
      title: text(t.title) || text(t.code),
      detail: `${text(t.code)} · ${text(t.status).replace(/_/g, " ")}${t.priority ? ` · ${text(t.priority)} priority` : ""}`,
      meta: t.deadline ? `Task Manager • due ${text(t.deadline).slice(0, 10)}` : "Task Manager",
      at: text(t.deadline) || null,
      href: "/task-manager",
      action: { type: "open" },
    });
  }

  if (leadsToday) {
    items.push({
      id: "notification:leads-today",
      kind: "notification",
      title: `${leadsToday} new lead${leadsToday === 1 ? "" : "s"} today`,
      detail: "Captured since midnight (IST).",
      meta: "Lead Manager",
      at: null,
      href: "/lead-manager",
      action: { type: "open" },
    });
  }
  if (ordersToday) {
    items.push({
      id: "notification:orders-today",
      kind: "notification",
      title: `${ordersToday} paid order${ordersToday === 1 ? "" : "s"} today`,
      detail: "Paid since midnight (IST).",
      meta: "Marketplace Manager • Orders",
      at: null,
      href: "/marketplace-manager",
      action: { type: "open" },
    });
  }

  return { items, unavailable };
}
