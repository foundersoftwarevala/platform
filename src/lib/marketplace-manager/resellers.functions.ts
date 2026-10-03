import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Reseller Manager, over the reseller system already in place.
 *
 * The margin a reseller earns is never written into code here: it comes from
 * their reseller_membership_plans row — Starter 20%, Professional 30%, Master
 * 40% — unless a more specific rule overrides it. Tracking goes through the
 * same marketplace_referral_codes engine the affiliate and influencer consoles
 * use, so there is one attribution source, with the reseller's margin kept in
 * its own ledger so no event is ever settled twice.
 */

/** A database client that acts as the signed-in caller, never as the service. */
async function userClient() {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const client = await userClient();
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type ResellerStatus =
  | "pending" | "active" | "paused" | "suspended" | "rejected" | "terminated";

export type PlanCode =
  | "starter_reseller" | "professional_reseller" | "master_reseller";

export type ResellerRow = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string | null;
  region: string | null;
  tier: string;
  status: ResellerStatus;
  kyc_status: string;
  company_name: string | null;
  plan_code: PlanCode | null;
  user_id: string | null;
  created_at: string;
  last_active_at: string | null;
  plan: { name: string; profit_percent: number } | null;
  referral_codes: string[];
  clicks: number;
  conversions: number;
  sales: number;
  revenue: number;
  commission: number;
  available: number;
  paid_out: number;
};

export type ResellerPlan = {
  code: PlanCode;
  name: string;
  price_usd: number;
  profit_percent: number;
  validity_days: number;
  enabled: boolean;
  resellers: number;
  memberships: number;
};

export type ResellerOverview = {
  ok: boolean;
  reason?: string;
  total?: number;
  active?: number;
  pending?: number;
  suspended?: number;
  unplanned?: number;
  referral_codes?: number;
  clicks?: number;
  conversions?: number;
  sales?: number;
  revenue?: number;
  commission_total?: number;
  commission_pending?: number;
  commission_available?: number;
  commission_paid?: number;
  commission_reversed?: number;
  payouts_total?: number;
  payouts_paid?: number;
  payouts_pending?: number;
  plans?: ResellerPlan[];
  unavailable?: Record<string, string>;
  resellers?: ResellerRow[];
};

const status = z.enum([
  "pending", "active", "paused", "suspended", "rejected", "terminated",
]);
const plan = z.enum([
  "starter_reseller", "professional_reseller", "master_reseller",
]);

export const getResellers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(120).optional(),
      status: status.optional(),
      plan: plan.optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<ResellerOverview> =>
    callAsUser("mm_resellers", { p_query: data }),
  );

/**
 * One reseller, with the decisions on their payouts in its audit history.
 *
 * mm_reseller_detail lists the audit rows keyed to the reseller. A payout
 * decision is recorded against the payout (entity reseller_payout), so
 * approvals, payments, failures and reversals never showed in the reseller's
 * history. They are read here, as the caller - row level security on
 * marketplace_audit_logs still decides what the caller may see - and merged
 * in date order. A failed read leaves the history as the database gave it.
 */
export const getResellerDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> => {
    const detail = await callAsUser<Record<string, unknown>>("mm_reseller_detail", { p_id: data.id });
    const payouts = Array.isArray(detail?.payouts) ? (detail.payouts as { id?: unknown }[]) : [];
    const ids = payouts.map((p) => String(p.id ?? "")).filter(Boolean);
    if (detail?.ok === false || !ids.length) return detail;

    try {
      const client = await userClient();
      const since = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
      const { data: rows, error } = await client
        .from("marketplace_audit_logs")
        .select("action, created_at, actor_id, reason, before_state, after_state")
        .eq("entity_type", "reseller_payout")
        .in("entity_id", ids)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error || !rows?.length) return detail;
      const extra = rows.map((a) => ({
        action: a.action, at: a.created_at, actor: a.actor_id,
        reason: a.reason, before: a.before_state, after: a.after_state,
      }));
      const audit = [...((detail.audit as Record<string, unknown>[] | undefined) ?? []), ...extra]
        .sort((x, y) => String(y.at ?? "").localeCompare(String(x.at ?? "")));
      return { ...detail, audit };
    } catch {
      return detail;
    }
  });

/** Approve, pause, suspend, reject or reactivate. */
export const setResellerStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(), status, reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_reseller_status", {
      p_id: data.id, p_to: data.status, p_reason: data.reason ?? null,
    }),
  );

/**
 * Put a reseller on a plan.
 *
 * The plan sets their margin for future sales. Commission already earned keeps
 * the rate recorded on it at the time, so changing a plan never rewrites what
 * somebody has already been credited.
 */
export const setResellerPlan = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      plan: plan.nullable(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_reseller_plan", {
      p_id: data.id, p_plan: data.plan, p_reason: data.reason ?? null,
    }),
  );

/** Issue a referral link, in the canonical referral table. */
export const createResellerCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), code: z.string().max(40).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string; code?: string; share_url?: string;
  }> => callAsUser("mm_reseller_code_create", {
    p_id: data.id,
    p_code: data.code && data.code.trim() !== "" ? data.code.trim() : null,
  }));

export const setResellerSchedule = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      reseller_id: z.string().uuid(),
      cadence: z.enum(["weekly", "biweekly", "monthly", "custom"]).optional(),
      holding_days: z.number().int().min(0).max(180).optional(),
      minimum_amount: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      requires_approval: z.boolean().optional(),
      payment_method: z.string().max(60).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_reseller_schedule_set", { p_patch: data }),
  );

/** Move commission past its holding period from pending to available. */
export const releaseResellerEarnings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; released?: number; reason?: string }> =>
    callAsUser("mm_reseller_earnings_release", { p_id: data.id ?? null }),
  );

export const createResellerPayout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    payout?: Record<string, unknown>; lines?: number;
  }> => callAsUser("mm_reseller_payout_create", {
    p_id: data.id, p_reason: data.reason ?? null,
  }));

/**
 * Move a payout along.
 *
 * Paying one requires the provider's transaction reference; failing or
 * reversing one requires a stated reason. Neither is optional, because both are
 * the record of what happened to somebody's money.
 */
export const setResellerPayoutStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum([
        "pending", "approved", "processing", "paid", "failed", "reversed", "cancelled",
      ]),
      reference: z.string().max(120).optional(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_reseller_payout_status", {
      p_payout: data.id, p_to: data.status,
      p_reference: data.reference ?? null, p_reason: data.reason ?? null,
    }),
  );

export type ResellerAttention = {
  ok: boolean;
  reason?: string;
  as_of?: string;
  applications_pending?: number;
  applications_kyc_unverified?: number;
  oldest_application_at?: string | null;
  membership_payments_to_verify?: number;
  membership_orders_awaiting_payment?: number;
  memberships_expiring_30d?: number;
  commission_available?: { currency: string; amount: number; resellers: number }[];
  payouts_awaiting_action?: number;
  suspended?: number;
};

/** The Reseller Manager's attention banner, counted by the database now. */
export const getResellerAttention = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResellerAttention> => callAsUser("mm_reseller_attention", {}),
);
