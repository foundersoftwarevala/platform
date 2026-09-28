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
 * Only influencer is wired so far, through influencer_programme_summary(),
 * which counts the whole programme in SQL. The others return null and fall back
 * to the empty snapshot, which is the honest answer until each has a summary of
 * its own - the same mistake would be to make a number up for them here.
 *
 * This reads with the service-role key against the VPS gateway, because it runs
 * on the server for an operator console that row level security has already let
 * through at the route.
 */
async function fetchFromPlatform(
  params: FetchAnalyticsParams,
): Promise<DashboardAnalytics | null> {
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
