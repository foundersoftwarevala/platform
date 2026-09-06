import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * A role's full progression chain, with the state the signed-in person is
 * actually in for every asset on it.
 *
 * The Trophy Stage Vault renders the 180 stage trophies from the TROPHIES
 * constant, which is the right way to hold art direction: the catalogue is the
 * same for everybody and does not need a round trip. What the constant cannot
 * know is whether *this* person has earned any of it, so the gallery had no way
 * to distinguish locked from earned and showed all 180 as if they were the
 * same. This supplies the missing half.
 *
 * It calls ams_role_chain as the caller rather than as the service role, so a
 * person receives their own standing and an operator may look at somebody
 * else's only because the function checks ams_is_operator() itself. Asking on
 * behalf of another person is refused in the database, not here.
 *
 * When nobody is signed in the chain still returns — every stage locked, all
 * progress zero. That is the honest empty state the blueprint asks for: the
 * catalogue is public, the achievement is not.
 */

const AssetState = z.enum(["locked", "in_progress", "eligible", "earned", "claimed"]);
export type AssetState = z.infer<typeof AssetState>;

export type ChainAsset = {
  slug: string | null;
  name: string | null;
  rarity?: string | null;
  tier?: string | null;
  state: AssetState;
};

export type ChainStage = {
  stage: number;
  title: string;
  tagline: string | null;
  min_xp: number;
  next_min_xp: number | null;
  progress_pct: number;
  trophy: ChainAsset;
  award: ChainAsset;
  badge: ChainAsset;
  achievement: ChainAsset;
  standing: { rank: string | null; level: string | null };
};

export type RoleChain = {
  ok: boolean;
  role: string;
  user_id: string | null;
  total_xp: number;
  current_stage: number;
  passport: { passport_no: string; verification: string; issued_at: string } | null;
  stages: ChainStage[];
};

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) return null;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // No token means a signed-out visitor, and the database answers with the
    // catalogue and nothing personal. That is a valid state, not an error.
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? null) as T | null;
}

export const getRoleChain = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ role: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<RoleChain | null> => {
    return callAsUser<RoleChain>("ams_role_chain", {
      p_role: data.role,
      p_user_id: null,
    });
  });

/**
 * Claim an award that has already been earned.
 *
 * The only AMS write a signed-in person is permitted. It cannot create an
 * entitlement — the database refuses with `not_earned` if there is no
 * user_awards row — so the worst a caller can do is claim something they
 * already hold.
 */
export const claimAward = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ awardSlug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = await callAsUser<{ ok: boolean; reason?: string; claimed?: string }>(
      "ams_claim_award",
      { p_award_slug: data.awardSlug },
    );
    if (!result?.ok) {
      throw new Error(
        result?.reason === "not_earned"
          ? "This award has not been earned yet."
          : result?.reason === "not_signed_in"
            ? "Sign in to claim an award."
            : (result?.reason ?? "The claim was refused."),
      );
    }
    return result;
  });
