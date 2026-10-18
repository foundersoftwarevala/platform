import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import { getResellerOverview, type ResellerOverview } from "@/lib/reseller-dashboard.functions";

/**
 * Real home-screen figures for the reseller who is signed in.
 *
 * The reseller's KPI cards were drawn by the seeded generator in lib/metrics.ts
 * - invented counts, invented dollar amounts, invented trends - and the
 * profile hero and top-bar pills were fixed dashes. All of them now read one
 * answer from getResellerOverview, which works out the caller's reseller
 * record from their session on the server and reads the tables that hold the
 * figures. One query, shared by every widget that shows a part of it.
 *
 * `enabled` is false on every other role's dashboard, which keeps its
 * behaviour exactly as it was.
 */
export function useResellerOverview(enabled: boolean) {
  const fetchOverview = useServerFn(getResellerOverview);
  const query = useQuery({
    queryKey: ["reseller", "overview"],
    queryFn: () => fetchOverview() as Promise<ResellerOverview>,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
  return { overview: enabled ? query.data ?? null : null, loading: enabled && query.isLoading };
}

/**
 * KPI values for the reseller dashboard, or undefined on any other role.
 *
 * Unlike the other partner dashboards, nothing borrowed from the sample engine
 * is shown while the answer loads or if it fails: every card reads "—" until a
 * real figure is in, and a card with no source keeps reading "—".
 */
export function useResellerMetrics(role: string) {
  const enabled = role === "reseller";
  const { overview } = useResellerOverview(enabled);
  if (!enabled) return { values: undefined };
  return { values: overview?.metrics ?? {} };
}
