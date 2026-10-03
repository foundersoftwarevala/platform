import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EntityFilter = {
  column: string;
  /** `not_null` ignores `value` and keeps rows where `column` is set. */
  op?: "eq" | "neq" | "ilike" | "in" | "gt" | "gte" | "lt" | "lte" | "not_null";
  value: unknown;
};

/** Apply filters to a PostgREST query. Blank / "all" values are skipped. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, filters: EntityFilter[]): any {
  for (const f of filters) {
    if (f.op === "not_null") { q = q.not(f.column, "is", null); continue; }
    if (f.value == null || f.value === "" || f.value === "all") continue;
    const op = f.op ?? "eq";
    // dynamic filter dispatch (types loosened via client cast)
    q = q[op](f.column, f.value);
  }
  return q;
}

export type EntityListOptions<T = Record<string, unknown>> = {
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
  /** False skips the request entirely (the wall has no source for it). */
  enabled?: boolean;
  /**
   * Turns the stored rows into the shape the wall renders. Runs after the
   * page is fetched, so it may read related records for that page.
   */
  mapRows?: (rows: Record<string, unknown>[]) => T[] | Promise<T[]>;
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
export function useEntityList<T = Record<string, unknown>>(opts: EntityListOptions<T>) {
  const {
    table,
    select = "*",
    search,
    filters = [],
    order = { column: "created_at", ascending: false },
    page = 1,
    pageSize = 25,
    countMode = "estimated",
    enabled = true,
    mapRows,
  } = opts;

  return useQuery<EntityListResult<T>>({
    queryKey: ["entity", table, { select, search, filters, order, page, pageSize, countMode }],
    enabled,
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

      q = applyFilters(q, filters);
      if (search?.q && search.columns.length) {
        const or = search.columns.map((c) => `${c}.ilike.%${search.q}%`).join(",");
        q = q.or(or);
      }

      const { data, error, count } = await q.abortSignal(signal);
      if (error) throw error;
      const total = count ?? 0;
      const stored = (data ?? []) as Record<string, unknown>[];
      return {
        rows: mapRows ? await mapRows(stored) : (stored as T[]),
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
  enabled = true,
  /** The select the list uses, when its filters reach into an embedded table. */
  select = "*",
) {
  return useQuery({
    queryKey: ["entity-count", table, filters, countMode, select],
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o: { count: "exact" | "estimated"; head: true }) => any;
        };
      };
      const q = applyFilters(client.from(table).select(select, { count: countMode, head: true }), filters);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
