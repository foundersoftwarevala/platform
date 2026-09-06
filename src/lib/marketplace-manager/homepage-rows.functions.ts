import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Superseded row functions, plus the Marketplace Manager control-room summary.
 *
 * This file used to hold its own listHomepageRows, setHomepageRowStatus,
 * reorderHomepageRows and duplicateHomepageRow, all written against
 * marketplace_homepage_sections — a table the public homepage has never read.
 * The homepage builds its rows from marketplace_categories, so those functions
 * controlled nothing, and keeping a second listHomepageRows alive was exactly
 * the duplicate source of truth the engineering rules forbid.
 *
 * Nothing is deleted. The row exports below now re-export the real
 * implementations from ./rows.functions, so any caller that finds this module
 * reaches the functions that actually move the front page. New code should
 * import ./rows.functions directly.
 */

export {
  listHomepageRows,
  getRowProducts,
  assignSlot,
  removeSlot,
  moveSlot,
  pinSlot,
  configureRow,
  reorderRows,
  createRow,
  getRowAnalytics,
  searchRowProducts,
  type HomepageRow,
  type RowSlot,
} from "./rows.functions";

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type MarketplaceDashboard = {
  ok: boolean;
  reason?: string;
  generated_at: string;
  products: {
    total: number; published: number; draft: number; archived: number;
    hidden: number; with_demo: number; with_image: number;
    sellers: number; categories: number;
  };
  commerce: {
    orders: number; paid: number; pending: number; refunds: number;
    /** Null when the platform has no downloads table — not tracked, not zero. */
    downloads: number | null;
  };
  revenue: {
    today: number; this_week: number; this_month: number; this_year: number;
    all_time: number; refunded: number; net: number;
    currency: string; has_transactions: boolean;
  };
  queues: { key: string; label: string; count: number; destination: string }[];
  activity: { at: string; kind: string; source: string; label: string; detail: string }[];
  score: { score: number | null; factors: { destination?: string }[] } | null;
  attention: { items: { count: number; destination: string }[] } | null;
  health: { check_key: string; affected: number; destination?: string }[];
};

/**
 * Everything the control room shows, counted in one round trip.
 *
 * The dashboard rendered "—" in every KPI card because it called nothing at
 * all. This returns the real figures, and is deliberately honest about the two
 * things this database cannot answer: there is no downloads table and no
 * collections table, so those come back null for the UI to render as "not
 * tracked" rather than as a measured zero.
 */
export const marketplaceControlSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketplaceDashboard> => {
    const data = await callAsUser<MarketplaceDashboard>("mm_dashboard", {});
    if (!data?.ok) {
      throw new Error(
        data?.reason === "not_permitted"
          ? "The marketplace control room needs operator rights."
          : "The control room could not be loaded.",
      );
    }
    return data;
  },
);
