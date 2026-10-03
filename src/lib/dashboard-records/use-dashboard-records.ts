import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import type { CrudRecord } from "@/lib/crud-store";

import { getDeveloperMetrics, listDashboardRecords } from "./records.functions";

/** A role dashboard module's records, read from the platform for the signed-in partner. */
export function useDashboardRecords(role: string, module: string, enabled: boolean) {
  const list = useServerFn(listDashboardRecords);
  const query = useQuery({
    queryKey: ["dashboard-records", role, module],
    queryFn: () => list({ data: { role, module } }),
    enabled,
  });
  return {
    records: (query.data?.records ?? []) as CrudRecord[],
    note: query.data?.note ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => void query.refetch(),
  };
}

/**
 * The developer dashboard's real KPI figures. Other roles get undefined, so
 * their dashboards are untouched; a developer with no developer profile gets
 * an empty set, and every card reads "not tracked yet".
 */
export function useDeveloperMetrics(role: string) {
  const enabled = role === "developer";
  const read = useServerFn(getDeveloperMetrics);
  const query = useQuery({
    queryKey: ["developer-metrics"],
    queryFn: () => read(),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
  if (!enabled) return { values: undefined };
  // Never undefined for a developer: undefined would hand the cards to the
  // sample engine, which drew invented figures until the server answered.
  return { values: query.data?.metrics ?? {} };
}
