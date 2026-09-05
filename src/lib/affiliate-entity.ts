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
};

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
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o?: { count?: "exact" | "estimated"; head?: boolean }) => any;
        };
      };
      let q = client
        .from(table)
        .select(select, { count: countMode })
        .order(order.column, { ascending: !!order.ascending })
        .range((page - 1) * pageSize, page * pageSize - 1);

      for (const f of filters) {
        if (f.value == null || f.value === "" || f.value === "all") continue;
        const op = f.op ?? "eq";
        // dynamic filter dispatch (types loosened via client cast)
        q = q[op](f.column, f.value);
      }
      if (search?.q && search.columns.length) {
        const or = search.columns.map((c) => `${c}.ilike.%${search.q}%`).join(",");
        q = q.or(or);
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
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o: { count: "exact" | "estimated"; head: true }) => any;
        };
      };
      let q = client.from(table).select("*", { count: countMode, head: true });
      for (const f of filters) {
        if (f.value == null || f.value === "" || f.value === "all") continue;
        const op = f.op ?? "eq";
        q = q[op](f.column, f.value);
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
