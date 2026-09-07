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

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
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

export const getResellerDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_reseller_detail", { p_id: data.id }),
  );

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
