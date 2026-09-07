import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Author Manager and Vendor Manager, over the seller system already in place.
 *
 * An author and a vendor are the same kind of record here — a row in
 * marketplace_sellers that owns products, earns a share of each sale through
 * marketplace_commissions, and is paid through marketplace_payouts. The two
 * consoles are therefore one set of calls with a `kind` on them, not two
 * parallel backends, and the commission engine in src/lib/commerce/commission.ts
 * is left exactly as it is: it already resolves the most specific active rule
 * and writes commissions idempotently when an order settles.
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

export type SellerKind = "author" | "vendor";
export type SellerStatus =
  | "pending" | "approved" | "rejected" | "suspended" | "deactivated";

export type SellerRow = {
  id: string;
  name: string;
  slug: string;
  status: SellerStatus;
  kind: SellerKind | null;
  owner_user_id: string | null;
  payout_currency: string;
  created_at: string;
  approved_at: string | null;
  products: number;
  published: number;
  sales: number;
  gross: number;
  earned: number;
  available: number;
  paid_out: number;
  commission_rate: number | null;
  members: number;
};

export type SellerOverview = {
  ok: boolean;
  reason?: string;
  kind?: SellerKind | null;
  total?: number;
  approved?: number;
  pending?: number;
  suspended?: number;
  unclassified?: number;
  products?: number;
  published?: number;
  sales?: number;
  gross?: number;
  marketplace_share?: number;
  seller_share?: number;
  reversed?: number;
  pending_earnings?: number;
  available_earnings?: number;
  paid_earnings?: number;
  payouts_total?: number;
  payouts_paid?: number;
  payouts_pending?: number;
  unassigned_products?: number;
  sellers?: SellerRow[];
};

const kind = z.enum(["author", "vendor"]);
const status = z.enum(["pending", "approved", "rejected", "suspended", "deactivated"]);

export const getSellers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      kind: kind.optional(),
      search: z.string().max(120).optional(),
      status: status.optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<SellerOverview> =>
    callAsUser("mm_sellers", { p_query: data }),
  );

export const getSellerDetail = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_seller_detail", { p_id: data.id }),
  );

/**
 * Approve, reject, suspend or reactivate.
 *
 * A rejection or suspension needs a reason: it stops someone earning and their
 * products come off the storefront, so the audit trail should say why.
 */
export const setSellerStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status,
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_seller_status", {
      p_id: data.id, p_to: data.status, p_reason: data.reason ?? null,
    }),
  );

export const setSellerKind = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), kind: kind.nullable() }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_seller_kind", { p_id: data.id, p_kind: data.kind }),
  );

/**
 * The marketplace's percentage of this seller's sales.
 *
 * Writing this changes future sales only. The rate that applied to a sale
 * already settled stays frozen in that commission's rule_snapshot, so changing
 * terms never rewrites history.
 */
export const setSellerCommission = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      rate: z.number().min(0).max(100),
      fixed: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_seller_commission_set", {
      p_seller: data.id, p_rate: data.rate, p_fixed: data.fixed ?? 0,
      p_currency: data.currency ?? "USD", p_reason: data.reason ?? null,
    }),
  );

export const setPayoutSchedule = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      seller_id: z.string().uuid(),
      cadence: z.enum(["weekly", "biweekly", "monthly", "custom"]).optional(),
      holding_days: z.number().int().min(0).max(180).optional(),
      minimum_amount: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      requires_approval: z.boolean().optional(),
      payment_method: z.string().max(60).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_seller_schedule_set", { p_patch: data }),
  );

/** Move earnings past their holding period from pending to available. */
export const releaseEarnings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; released?: number; reason?: string }> =>
    callAsUser("mm_seller_earnings_release", { p_seller: data.id ?? null }),
  );

/** Prepare a payout for everything this seller currently has released. */
export const createPayout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    payout?: Record<string, unknown>; lines?: number;
  }> => callAsUser("mm_seller_payout_create", {
    p_seller: data.id, p_reason: data.reason ?? null,
  }));

/**
 * Move a payout along.
 *
 * Completing one requires the reference from whoever actually sent the money.
 * Nothing is ever recorded as paid on somebody's say-so.
 */
export const setPayoutStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "approved", "processing", "completed", "failed", "cancelled"]),
      reference: z.string().max(120).optional(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; message?: string }> =>
    callAsUser("mm_seller_payout_status", {
      p_id: data.id, p_to: data.status,
      p_reference: data.reference ?? null, p_reason: data.reason ?? null,
    }),
  );
