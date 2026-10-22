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
  countMode?: "estimated" | "exact";
};

export type EntityListResult<T = Record<string, unknown>> = {
  rows: T[];
  count: number;
  countIsEstimate: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Paginated list fetcher for reseller-manager walls. Queries real Supabase tables.
 */
export function useResellerEntityList<T = Record<string, unknown>>(
  opts: EntityListOptions,
) {
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
    queryKey: ["reseller-entity", table, { select, search, filters, order, page, pageSize, countMode }],
    staleTime: 15_000,
    gcTime: 5 * 60_000,
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
        q = (q as any)[op](f.column, f.value);
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

// The reseller write helpers that used to live here (createReseller,
// createKycRecord, createLicense, createCommissionRule, createWalletTransaction,
// createSubscription, createSupportTicket, createReport, logAuditEvent, …)
// targeted tables that do not exist in the schema (reseller_kyc,
// reseller_licenses, reseller_wallet_transactions, reseller_subscriptions,
// reseller_support_tickets, reseller_reports, reseller_audit_logs). Nothing
// called them, and each would have thrown against a missing relation. The
// canonical reseller writes live in the Reseller Manager server functions
// (src/lib/marketplace-manager/resellers.functions.ts, over the mm_* RPCs) and
// the reseller dashboard server functions (src/lib/reseller-dashboard.functions.ts).
// Only the generic list hook and its types remain here.
