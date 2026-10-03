// Server-only repository for manager-console analytics (Creator, Reseller,
// Influencer, Franchise). Talks to the configured Software Vala backend over
// HTTP. When env is not configured it returns a well-formed empty snapshot so
// the UI renders a true zero-state — never fake or demo data.
//
// Environment contract (all optional; absence = not connected):
//   SOFTWARE_VALA_API_URL                Base URL of the analytics API.
//   SOFTWARE_VALA_API_KEY                Bearer token for the Authorization header.
//   SOFTWARE_VALA_ANALYTICS_PATH         Global override for the analytics path.
//   SOFTWARE_VALA_<MODULE>_ANALYTICS_PATH  Per-module override, e.g.
//                                        SOFTWARE_VALA_RESELLER_ANALYTICS_PATH

import {
  emptyDashboardAnalytics,
  METRIC_KEYS,
  type DashboardAnalytics,
  type MetricKey,
  type MetricSnapshot,
  type TimeRange,
} from "./types";

export type ModuleId = "creator" | "reseller" | "influencer" | "franchise" | "marketplace";

const DEFAULT_PATHS: Record<ModuleId, string> = {
  creator: "/v1/creator/analytics",
  reseller: "/v1/reseller/analytics",
  influencer: "/v1/influencer/analytics",
  franchise: "/v1/franchise/analytics",
  marketplace: "/v1/marketplace/analytics",
};

export interface FetchAnalyticsParams {
  module: ModuleId;
  range: TimeRange;
  scopeId?: string | undefined;
}

export async function fetchDashboardAnalytics(
  params: FetchAnalyticsParams,
): Promise<DashboardAnalytics> {
  const baseUrl = process.env["SOFTWARE_VALA_API_URL"];
  const apiKey = process.env["SOFTWARE_VALA_API_KEY"];

  if (!baseUrl || !apiKey) {
    /**
     * The external analytics API has never been configured.
     *
     * There are no SOFTWARE_VALA_* variables on the server at all, so this
     * returned an empty snapshot every single time - which is why the
     * Influencer, Creator, Reseller and Franchise consoles all showed zeros for
     * everything. The zero-state was honest about not being connected, but it
     * was reporting "not connected to an API that does not exist" while the
     * numbers sat in the platform's own database.
     *
     * Where the platform can answer the question itself, it now does. Anything
     * without a local answer still returns the empty snapshot, which is still
     * the right behaviour: a true zero-state, never invented data.
     */
    const local = await fetchFromPlatform(params);
    return local ?? emptyDashboardAnalytics(params.range);
  }

  const path =
    process.env[`SOFTWARE_VALA_${params.module.toUpperCase()}_ANALYTICS_PATH`] ??
    process.env["SOFTWARE_VALA_ANALYTICS_PATH"] ??
    DEFAULT_PATHS[params.module];

  const url = new URL(path, baseUrl);
  url.searchParams.set("range", params.range);
  url.searchParams.set("module", params.module);
  if (params.scopeId) url.searchParams.set("scopeId", params.scopeId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Software Vala analytics API ${res.status} ${res.statusText}`);
  }

  return normalizeAnalytics((await res.json()) as unknown, params.range);
}

function normalizeAnalytics(raw: unknown, range: TimeRange): DashboardAnalytics {
  if (!raw || typeof raw !== "object") throw new Error("Invalid analytics payload");
  const r = raw as Partial<DashboardAnalytics>;
  const base = emptyDashboardAnalytics(range);

  const metrics = { ...base.metrics };
  for (const key of METRIC_KEYS) {
    const m = (r.metrics as Record<MetricKey, MetricSnapshot> | undefined)?.[key];
    if (m) metrics[key] = { ...base.metrics[key], ...m, key };
  }

  return {
    range: r.range ?? range,
    generatedAt: r.generatedAt ?? new Date().toISOString(),
    connected: true,
    source: r.source ?? "software-vala",
    metrics,
  };
}

/**
 * The modules the platform can answer for itself, from its own database.
 *
 * Influencer is wired through influencer_programme_summary(), which counts the
 * whole programme in SQL, and reseller through the reseller console's own
 * functions (fetchResellerFromPlatform below). The others return null and fall
 * back to the empty snapshot, which is the honest answer until each has a
 * summary of its own - the same mistake would be to make a number up for them
 * here.
 *
 * This reads with the service-role key against the VPS gateway, because it runs
 * on the server for an operator console that row level security has already let
 * through at the route.
 */
async function fetchFromPlatform(
  params: FetchAnalyticsParams,
): Promise<DashboardAnalytics | null> {
  if (params.module === "reseller") return fetchResellerFromPlatform(params);
  if (params.module !== "influencer") return null;

  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/influencer_programme_summary`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) return null;
    const s = (await response.json()) as Record<string, unknown>;
    const n = (field: string) => Number(s[field] ?? 0) || 0;

    const base = emptyDashboardAnalytics(params.range);
    const metrics = { ...base.metrics };
    const set = (k: MetricKey, value: number) => {
      metrics[k] = { ...metrics[k], key: k, value, previousValue: 0, deltaPct: null };
    };

    set("influencers", n("influencers"));
    set("followers", n("followers_total"));
    // Reach is only claimable for accounts whose ownership has been verified.
    set("reach", n("followers_verified"));
    set("campaigns", n("assignments_active"));
    set("applications", n("applications_pending"));
    set("commissions", n("earnings_net"));
    set("payouts", n("payouts_total"));
    // Left at zero deliberately: the referral chain that would attribute a sale
    // or a lead to an influencer is not written to yet. The summary says so in
    // its own `unattributable` field; borrowing another count would look like
    // attribution working.
    set("sales", 0);
    set("leads", 0);

    return {
      ...base,
      connected: true,
      source: "platform:influencer_programme_summary",
      generatedAt: new Date().toISOString(),
      metrics,
    };
  } catch {
    return null;
  }
}

/**
 * The Reseller Manager's tiles, from the reseller tables.
 *
 * The caller is admitted by the database, not by this code: mm_resellers and
 * mm_reseller_attention are called with the caller's own token, and both answer
 * not_permitted to anyone who is not a reseller operator - in which case the
 * empty, "not connected" snapshot is returned. Only then are the per-currency
 * sums and the ticket count read with the service key.
 *
 * Every tile is a count or a sum from the database, over all time (there is no
 * per-range history to compare against, so no delta is claimed). A money tile
 * is shown only when its lines are in one currency - rupees and dollars do not
 * add up - and otherwise, like Leads, which no reseller table records, it is
 * marked unavailable and shows "—" rather than a zero.
 */
async function fetchResellerFromPlatform(
  params: FetchAnalyticsParams,
): Promise<DashboardAnalytics | null> {
  const url = process.env["SUPABASE_URL"]?.trim()?.replace(/\/+$/, "");
  const anon =
    process.env["SUPABASE_ANON_KEY"]?.trim() || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  const service = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!url || !anon || !service) return null;

  let token: string | null = null;
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  } catch {
    token = null;
  }
  if (!token) return null;

  const asCaller = async (fn: string, body: unknown) => {
    const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  };

  try {
    const [overview, attention] = await Promise.all([
      asCaller("mm_resellers", { p_query: { limit: 1 } }),
      asCaller("mm_reseller_attention", {}),
    ]);
    if (!overview || overview.ok !== true || !attention || attention.ok !== true) return null;

    const asService = (path: string, extra: Record<string, string> = {}) =>
      fetch(`${url}/rest/v1/${path}`, {
        headers: { apikey: service, Authorization: `Bearer ${service}`, ...extra },
      });

    // Commission lines that still count (not reversed), for referred revenue.
    const LINES_CAP = 10000;
    const linesResponse = await asService(
      `reseller_commissions?select=currency,gross_amount&status=neq.reversed&limit=${LINES_CAP + 1}`,
    );
    const lines = linesResponse.ok
      ? ((await linesResponse.json()) as { currency: string; gross_amount: number | string }[])
      : null;

    const ticketsResponse = await asService("reseller_support_tickets?select=id&limit=1", {
      Prefer: "count=exact",
    });
    const ticketRange = ticketsResponse.ok ? ticketsResponse.headers.get("content-range") : null;
    const tickets = ticketRange ? Number(ticketRange.split("/")[1]) : NaN;

    const base = emptyDashboardAnalytics(params.range);
    const metrics = { ...base.metrics };
    const set = (k: MetricKey, value: number, unit?: string) => {
      metrics[k] = { ...metrics[k], key: k, value, previousValue: 0, deltaPct: null, series: [] };
      if (unit !== undefined) metrics[k].unit = unit;
    };
    const unavailable = (k: MetricKey) => {
      metrics[k] = { ...metrics[k], key: k, value: 0, previousValue: 0, deltaPct: null, series: [], unavailable: true };
    };
    const n = (v: unknown) => Number(v ?? 0) || 0;

    set("resellers", n(overview.total));
    // Orders attributed to a reseller's referral link.
    set("orders", n(overview.conversions));
    // Memberships whose paid year ends within 30 days.
    set("renewals", n(attention.memberships_expiring_30d));
    if (Number.isFinite(tickets)) set("tickets", tickets);
    else unavailable("tickets");
    unavailable("leads");

    // Referred revenue: one currency, or nothing.
    if (lines && lines.length <= LINES_CAP) {
      const currencies = new Set(lines.map((l) => l.currency));
      if (currencies.size === 0) set("revenue", 0);
      else if (currencies.size === 1) {
        set("revenue", lines.reduce((sum, l) => sum + n(l.gross_amount), 0), [...currencies][0]);
      } else unavailable("revenue");
    } else unavailable("revenue");

    // Commission released and payable - the balance card's "Commission payable".
    const payable = Array.isArray(attention.commission_available)
      ? (attention.commission_available as { currency: string; amount: number | string }[])
      : [];
    if (payable.length === 0) set("commissions", 0);
    else if (payable.length === 1) set("commissions", n(payable[0]!.amount), payable[0]!.currency);
    else unavailable("commissions");

    return {
      ...base,
      connected: true,
      source: "platform:mm_resellers",
      generatedAt: new Date().toISOString(),
      metrics,
    };
  } catch {
    return null;
  }
}
