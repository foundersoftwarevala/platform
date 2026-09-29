import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EntityFilter = {
  column: string;
  op?: "eq" | "ilike" | "in" | "gte" | "lte";
  value: unknown;
};

export type EntityListOptions = {
  table: string;
  select?: string;
  search?: { q?: string; columns: string[] };
  filters?: EntityFilter[];
  order?: { column: string; ascending?: boolean };
  page?: number;
  pageSize?: number;
  /**
   * "estimated" (default) asks Postgres for the planner row estimate and only
   * falls back to a real COUNT under the configured threshold. At 1M+ rows an
   * exact count is a full sequential scan on every keystroke, so exact counts
   * are opt-in per wall.
   */
  countMode?: "estimated" | "exact";
};

export type EntityListResult<T = Record<string, unknown>> = {
  rows: T[];
  count: number;
  /** True when `count` is a planner estimate rather than an exact tally. */
  countIsEstimate: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  /**
   * True when the wall's table has no relation in the current platform yet, so
   * this is an empty result rather than a failed query. The wall shows its own
   * empty state instead of an error, and no request is sent.
   */
  unbacked?: boolean;
};

/**
 * Bind each affiliate-manager wall to the relation that actually holds its data
 * in the current Software Vala platform.
 *
 * The walls were written against short names (`affiliates`, `referral_codes`,
 * …). The integrated platform stores this data under the marketplace_* names,
 * so this maps console name → real relation, and lists the columns that
 * relation really has. `useEntityList`/`useEntityCount` use this map to query
 * the correct table and to drop any search/filter/order the real relation does
 * not have — a query against a missing column is what made these screens error.
 *
 * Ground truth: the relations below exist in the schema. A console name absent
 * from this map has no relation yet (the platform holds nothing for it — e.g.
 * affiliate wallet / payout ledger / campaigns), so its wall reads as empty
 * rather than broken. No view or duplicate table is created; the UI is unchanged.
 */
type Binding = { relation: string; columns: string[]; order?: string };

const WALL_BINDINGS: Record<string, Binding> = {
  affiliates: {
    relation: "marketplace_affiliate_partners",
    columns: ["id", "user_id", "display_name", "status", "created_at", "updated_at"],
  },
  referral_codes: {
    relation: "marketplace_referral_codes",
    columns: ["id", "code", "active", "affiliate_partner_id", "influencer_profile_id", "reseller_id", "created_at", "updated_at"],
  },
  affiliate_links: {
    relation: "marketplace_referral_codes",
    columns: ["id", "code", "active", "affiliate_partner_id", "influencer_profile_id", "reseller_id", "created_at", "updated_at"],
  },
  referral_network: {
    relation: "marketplace_referral_sessions",
    columns: ["id", "session_key", "referral_code_id", "affiliate_partner_id", "product_id", "converted_order_id", "landing_url", "first_seen_at", "last_seen_at", "created_at"],
    order: "first_seen_at",
  },
  commissions: {
    relation: "marketplace_order_attributions",
    columns: ["id", "order_id", "affiliate_partner_id", "referral_code_id", "attribution_method", "click_id", "attributed_at", "created_at", "session_id"],
    order: "attributed_at",
  },
  sales: {
    relation: "marketplace_order_attributions",
    columns: ["id", "order_id", "affiliate_partner_id", "referral_code_id", "attribution_method", "click_id", "attributed_at", "created_at", "session_id"],
    order: "attributed_at",
  },
};

export function resolveWall(table: string): Binding | null {
  return WALL_BINDINGS[table] ?? null;
}

function emptyResult<T>(page: number, pageSize: number): EntityListResult<T> {
  return { rows: [], count: 0, countIsEstimate: false, page, pageSize, totalPages: 1, unbacked: true };
}

/**
 * Generic paginated list fetcher for every affiliate-manager wall. Uses
 * head+count for total, indexed range for the current page, ilike for
 * search, and stable query keys so realtime invalidations coalesce
 * per-table.
 */
export function useEntityList<T = Record<string, unknown>>(opts: EntityListOptions) {
  const {
    table,
    select = "*",
    search,
    filters = [],
    order = { column: "created_at", ascending: false },
    page = 1,
    pageSize = 25,
    countMode = "estimated",
  } = opts;

  return useQuery<EntityListResult<T>>({
    queryKey: ["entity", table, { select, search, filters, order, page, pageSize, countMode }],
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    // Keep the previous page on screen while the next one loads instead of
    // collapsing the table back to a skeleton on every pagination click.
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: async ({ signal }) => {
      // Bind the wall to the real relation. A wall with no relation yet reads
      // as empty rather than firing a query against a table that isn't there.
      const bound = resolveWall(table);
      if (!bound) return emptyResult<T>(page, pageSize);
      const has = (col: string) => bound.columns.includes(col);
      const orderCol = has(order.column) ? order.column : (bound.order ?? "created_at");

      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o?: { count?: "exact" | "estimated"; head?: boolean }) => any;
        };
      };
      let q = client
        .from(bound.relation)
        .select(select, { count: countMode })
        .order(orderCol, { ascending: !!order.ascending })
        .range((page - 1) * pageSize, page * pageSize - 1);

      for (const f of filters) {
        if (f.value == null || f.value === "" || f.value === "all") continue;
        if (!has(f.column)) continue; // skip filters the real relation lacks
        const op = f.op ?? "eq";
        // dynamic filter dispatch (types loosened via client cast)
        q = q[op](f.column, f.value);
      }
      if (search?.q) {
        const cols = search.columns.filter(has);
        if (cols.length) {
          const or = cols.map((c) => `${c}.ilike.%${search.q}%`).join(",");
          q = q.or(or);
        }
      }

      const { data, error, count } = await q.abortSignal(signal);
      if (error) throw error;
      const total = count ?? 0;
      return {
        rows: (data ?? []) as T[],
        count: total,
        countIsEstimate: countMode === "estimated" && total > 1000,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    },
  });
}

/** Just the head count for a table + optional filters — used by KPI cards. */
export function useEntityCount(
  table: string,
  filters: EntityFilter[] = [],
  countMode: "estimated" | "exact" = "estimated",
) {
  return useQuery({
    queryKey: ["entity-count", table, filters, countMode],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const bound = resolveWall(table);
      if (!bound) return 0;
      const has = (col: string) => bound.columns.includes(col);
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o: { count: "exact" | "estimated"; head: true }) => any;
        };
      };
      let q = client.from(bound.relation).select("*", { count: countMode, head: true });
      for (const f of filters) {
        if (f.value == null || f.value === "" || f.value === "all") continue;
        if (!has(f.column)) continue;
        const op = f.op ?? "eq";
        q = q[op](f.column, f.value);
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
