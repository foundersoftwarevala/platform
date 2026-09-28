import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * The whole influencer programme, for the operator console.
 *
 * Influencer Manager showed zeros for everything while the programme held ten
 * profiles, seven applications and six payouts. Nothing had failed - there were
 * no failed requests and no console errors. The console was simply asking the
 * wrong question: it used influencerDashboardQueryOptions(), which is the
 * *creator's own* view. That looks up influencer_profiles by
 * user_id = auth.uid(), and only two of the ten profiles carry a user_id at all
 * - the owner's account is not one of them - so it found no profile and
 * returned an empty dashboard to the person who runs the programme.
 *
 * This asks the operator's question instead, and asks it of the VPS, which is
 * where the platform's data lives. The counting is done in SQL by
 * influencer_programme_summary(), so the figures cannot drift from a list that
 * happened to be capped - the creator view reads its tables with .limit(2000)
 * and counts them in the browser, which is the shape that goes quietly wrong
 * the day the programme passes two thousand of anything.
 *
 * It carries the operator's own token, so row level security decides what they
 * may see.
 */

export type InfluencerProgramme = {
  influencers: number;
  influencers_active: number;
  applications_total: number;
  applications_pending: number;
  assignments: number;
  assignments_active: number;
  social_accounts: number;
  followers_total: number;
  followers_verified: number;
  earnings_net: number;
  payouts_total: number;
  payouts_paid: number;
  payouts_pending: number;
  invoices: number;
  compensation_rules: number;
  /** Numbers that cannot honestly be produced yet, and why. */
  unattributable: Record<string, string>;
};

function gateway(): string {
  const base = process.env.SUPABASE_URL?.trim() ?? process.env.VITE_SUPABASE_URL?.trim() ?? "";
  if (!base) throw new Error("The database is not configured on this server.");
  return base.replace(/\/+$/, "");
}

export const getInfluencerProgramme = createServerFn({ method: "GET" }).handler(
  async (): Promise<InfluencerProgramme> => {
    const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new Error("Unauthorized: sign in required");

    const publishable =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
      process.env.SUPABASE_ANON_KEY?.trim() ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ??
      "";

    const response = await fetch(`${gateway()}/rest/v1/rpc/influencer_programme_summary`, {
      method: "POST",
      headers: {
        apikey: publishable,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`The influencer programme could not be read: ${response.status} ${detail.slice(0, 160)}`);
    }
    return (await response.json()) as InfluencerProgramme;
  },
);
