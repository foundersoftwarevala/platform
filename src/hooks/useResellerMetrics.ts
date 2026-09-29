import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import { getResellerMetrics } from "@/lib/reseller-dashboard.functions";

/**
 * Real KPI figures for the reseller dashboard.
 *
 * The reseller tiles were rendered by the sample-number engine. This reads the
 * reseller's own clients, leads, licences, commission and payouts through
 * getResellerMetrics — the same rows the Clients/Leads/Licenses workspaces and
 * the Reseller Manager use — so the numbers at the top of the dashboard are the
 * account's real ones. Only the reseller dashboard asks for it; every other
 * role is left exactly as it was.
 */
export function useResellerMetrics(role: string) {
  const enabled = role === "reseller";
  const fetchMetrics = useServerFn(getResellerMetrics);

  const query = useQuery({
    queryKey: ["reseller-metrics"],
    queryFn: () => fetchMetrics() as Promise<{ metrics: Record<string, number | null> }>,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  if (!enabled) return { values: undefined, loading: false };

  // While loading, keep the tiles on the sample engine (undefined) rather than
  // flashing dashes; once loaded, real figures and honest nulls take over.
  const values = query.data?.metrics ?? (query.isLoading ? undefined : {});
  return { values, loading: query.isLoading };
}
