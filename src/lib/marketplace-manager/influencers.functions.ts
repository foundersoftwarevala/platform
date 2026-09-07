import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Influencer Manager, over the influencer tables this project already has.
 *
 * Nothing here is a second attribution system. The brief asked for tracking
 * links, conversions and an attribution engine, and all three already exist as
 * marketplace_referral_codes, marketplace_referral_sessions and
 * marketplace_order_attributions — the tables the affiliate tracker at
 * /api/track/ref already writes. A referral code minted here goes into that
 * same table with influencer_profile_id set, so the machinery that is already
 * running picks it up without a line of new tracking code.
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

export type InfluencerRow = {
  id: string;
  name: string;
  email: string;
  country: string | null;
  region: string | null;
  niche: string;
  status: "pending" | "active" | "suspended" | "inactive";
  created_at: string;
  social_accounts: number;
  referral_codes: number;
  earnings_net: number;
  payouts_paid: number;
};

export type InfluencerOverview = {
  ok: boolean;
  reason?: string;
  creators?: number;
  by_status?: Record<string, number>;
  applications?: number;
  social_accounts?: number;
  declared_followers?: number;
  verified_accounts?: number;
  agreements?: number;
  assignments?: number;
  earnings_gross?: number;
  earnings_net?: number;
  payouts_total?: number;
  payouts_paid?: number;
  payouts_pending?: number;
  referral_codes?: number;
  sessions?: number;
  conversions?: number;
  unavailable?: Record<string, string>;
  profiles?: InfluencerRow[];
};

export const getInfluencers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(120).optional(),
      status: z.enum(["pending", "active", "suspended", "inactive"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<InfluencerOverview> =>
    callAsUser("mm_influencers", { p_query: data }),
  );

/**
 * Mint a referral code for a creator, in the canonical referral table.
 *
 * An optional word can be supplied for a creator who wants their own name in
 * the link; leaving it empty produces an eight-character code over an alphabet
 * with no I, L, O, 0 or 1, so it survives being read out on camera.
 */
export const createInfluencerCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      profile: z.string().uuid(),
      code: z.string().max(40).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; message?: string;
    code?: string; share_url?: string;
  }> => callAsUser("mm_influencer_code_create", {
    p_profile: data.profile,
    p_code: data.code && data.code.trim() !== "" ? data.code.trim() : null,
  }));

/**
 * Change a creator's status.
 *
 * Suspending or deactivating also switches off their referral codes, because
 * otherwise a suspended creator keeps being credited for sales.
 */
export const setInfluencerStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      profile: z.string().uuid(),
      status: z.enum(["pending", "active", "suspended", "inactive"]),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callAsUser("mm_influencer_status", {
      p_profile: data.profile,
      p_to: data.status,
      p_reason: data.reason ?? null,
    }),
  );
