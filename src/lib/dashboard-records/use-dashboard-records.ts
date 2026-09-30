import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@/lib/serverFn";
import type { CrudRecord } from "@/lib/crud-store";

import { listDashboardRecords } from "./records.functions";

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
