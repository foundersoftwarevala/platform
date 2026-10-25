import { z } from "zod";

const StageMetricSchema = z.object({
  stage: z.string().min(1).max(80),
  count: z.number().int().nonnegative(),
  recorded_value: z.string().nullable(),
});

const LeadMetricSchema = z.object({
  status: z.string().min(1).max(80),
  count: z.number().int().nonnegative(),
  recorded_value: z.string().nullable(),
});

const OrderMetricSchema = z.object({
  status: z.string().min(1).max(80),
  currency: z.string().length(3),
  count: z.number().int().nonnegative(),
  total: z.string().nullable(),
});

const TaskMetricSchema = z.object({
  status: z.string().min(1).max(80),
  count: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
});

export const CommercialSummarySchema = z.object({
  measured_at: z.string().datetime(),
  sales_deals: z.array(StageMetricSchema),
  sales_leads: z.array(StageMetricSchema),
  lead_manager_leads: z.array(LeadMetricSchema),
  unavailable_sources: z.array(z.string().min(1).max(300)),
  marketplace_orders: z.array(OrderMetricSchema),
  tasks: z.array(TaskMetricSchema),
});

export type CommercialSummary = z.infer<typeof CommercialSummarySchema>;

function restUrl(): string {
  return process.env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

function restHeaders(accessToken: string): Record<string, string> {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || "";
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY is not configured");
  if (!accessToken.trim()) throw new Error("An authenticated user token is required");
  return {
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** Fetch only aggregates scoped by the caller's authenticated database identity. */
export async function loadCommercialSummary(accessToken: string): Promise<CommercialSummary> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");

  const response = await fetch(`${base}/rest/v1/rpc/ayra_commercial_summary`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`AYRA commercial retrieval failed (${response.status})`);
  }
  return CommercialSummarySchema.parse(await response.json());
}
