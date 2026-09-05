/**
 * Dev Mode Query Hook
 * Falls back to devDB when Supabase is unavailable
 * Provides identical interface to useResellerEntityList
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { devDB } from "./dev-data-layer";
import type { EntityListOptions, EntityListResult } from "./reseller-entity";

export function useDevModeEntityList<T = Record<string, unknown>>(
  opts: EntityListOptions,
): UseQueryResult<EntityListResult<T>, Error> {
  const {
    table,
    select = "*",
    search,
    filters = [],
    order = { column: "created_at", ascending: false },
    page = 1,
    pageSize = 25,
  } = opts;

  return useQuery<EntityListResult<T>>({
    queryKey: ["dev-entity", table, { select, search, filters, order, page, pageSize }],
    queryFn: async () => {
      // Fetch all rows from dev database
      let rows = devDB.select(table) as T[];

      // Apply filters
      for (const filter of filters) {
        rows = rows.filter((row: any) => {
          const val = row[filter.column];
          if (filter.op === "eq") return val === filter.value;
          if (filter.op === "ilike") return String(val).toLowerCase().includes(String(filter.value).toLowerCase());
          if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(val);
          return false;
        });
      }

      // Apply search
      if (search?.q) {
        const q = search.q.toLowerCase();
        rows = rows.filter((row: any) =>
          search.columns?.some((col) =>
            String(row[col] || "").toLowerCase().includes(q)
          ) ?? false
        );
      }

      // Apply sorting
      rows.sort((a: any, b: any) => {
        const aVal = a[order.column] ?? "";
        const bVal = b[order.column] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal));
        return order.ascending ? cmp : -cmp;
      });

      const total = rows.length;
      const totalPages = Math.ceil(total / pageSize);

      // Apply pagination
      const start = (page - 1) * pageSize;
      const paged = rows.slice(start, start + pageSize);

      return {
        rows: paged,
        count: total,
        countIsEstimate: false,
        page,
        pageSize,
        totalPages,
      };
    },
    staleTime: 5_000,
    gcTime: 5 * 60_000,
  });
}
