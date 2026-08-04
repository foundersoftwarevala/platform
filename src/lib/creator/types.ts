// Shared analytics domain models used by every manager console
// (Creator, Reseller, Influencer, Franchise).
// Backend implementations MUST conform to these shapes.

export type MetricKey =
  // shared / creator + influencer
  | "followers"
  | "reach"
  | "views"
  | "clicks"
  | "leads"
  | "sales"
  | "commissions"
  | "campaigns"
  | "content"
  | "influencers"
  | "applications"
  | "payouts"
  // reseller
  | "resellers"
  | "orders"
  | "revenue"
  | "renewals"
  | "tickets"
  | "conversion"
  // franchise
  | "franchises"
  | "countries"
  | "regions"
  | "licenses"
  | "royalty"
  | "onboarding"
  // marketplace
  | "products"
  | "vendors";

export type TimeRange = "1d" | "7d" | "30d" | "90d";

export interface MetricSeriesPoint {
  /** ISO-8601 timestamp (UTC) of the bucket. */
  t: string;
  /** Numeric value for the bucket. */
  v: number;
}

export interface MetricSnapshot {
  key: MetricKey;
  value: number;
  previousValue: number;
  /** Signed decimal delta vs previousValue, e.g. 0.124 = +12.4%. `null` when no baseline. */
  deltaPct: number | null;
  series: MetricSeriesPoint[];
  unit?: string;
}

export interface DashboardAnalytics {
  range: TimeRange;
  generatedAt: string;
  connected: boolean;
  source: string;
  metrics: Record<MetricKey, MetricSnapshot>;
}

export const METRIC_KEYS: MetricKey[] = [
  "followers",
  "reach",
  "views",
  "clicks",
  "leads",
  "sales",
  "commissions",
  "campaigns",
  "content",
  "influencers",
  "applications",
  "payouts",
  "resellers",
  "orders",
  "revenue",
  "renewals",
  "tickets",
  "conversion",
  "franchises",
  "countries",
  "regions",
  "licenses",
  "royalty",
  "onboarding",
  "products",
  "vendors",
];

const CURRENCY_KEYS = new Set<MetricKey>(["commissions", "revenue", "royalty", "payouts"]);

export function emptyMetric(key: MetricKey): MetricSnapshot {
  return {
    key,
    value: 0,
    previousValue: 0,
    deltaPct: null,
    series: [],
    ...(CURRENCY_KEYS.has(key) ? { unit: "USD" } : {}),
  };
}

export function emptyDashboardAnalytics(range: TimeRange): DashboardAnalytics {
  return {
    range,
    generatedAt: new Date().toISOString(),
    connected: false,
    source: "none",
    metrics: METRIC_KEYS.reduce(
      (acc, k) => {
        acc[k] = emptyMetric(k);
        return acc;
      },
      {} as Record<MetricKey, MetricSnapshot>,
    ),
  };
}
