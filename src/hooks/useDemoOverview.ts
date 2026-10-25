/**
 * DEMO MANAGER — LIVE OVERVIEW DATA
 * =================================
 * Reads the real `demos` and `demo_requests` tables from the Software Vala
 * backend and exposes them in the shape the Demo Manager dashboard renders.
 * No mock data: every field maps to a real column.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import {
  cloneManagedDemo,
  extendManagedDemo,
  listManagedDemos,
  listPendingDemoRequests,
  respondToDemoRequest as respondToDemoRequestFn,
  setManagedDemoStatus as setManagedDemoStatusFn,
} from "@/lib/demo-manager/demos.functions";
import type { DemoManagerRow } from "@/lib/demo-manager/demos.functions";

type DemoStatus = Database["public"]["Enums"]["demo_status"];

/** UI-facing lifecycle label used by the dashboard filters. */
export type DemoUiStatus = "running" | "paused" | "expired";

export interface DemoOverviewItem {
  id: string;
  name: string;
  product: string;
  status: DemoUiStatus;
  dbStatus: DemoStatus;
  activeUsers: number;
  expiresIn: string;
  createdBy: string;
  region: string;
  usagePercent: number;
  url: string;
}

export interface DemoRequestItem {
  id: string;
  company: string;
  product: string;
  requestedBy: string;
  priority: "high" | "medium" | "low";
  requestDate: string;
  status: string;
}

const isExpired = (row: DemoManagerRow) =>
  Boolean(row.expiry_date && new Date(row.expiry_date).getTime() < Date.now());

const toUiStatus = (row: DemoManagerRow): DemoUiStatus => {
  if (isExpired(row) || row.status === "down") return "expired";
  if (row.status === "active") return "running";
  return "paused";
};

const daysLeftLabel = (expiry: string | null): string => {
  if (!expiry) return "No expiry";
  const diff = new Date(expiry).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / 86_400_000);
  return days === 1 ? "1 day" : `${days} days`;
};

const mapDemo = (row: DemoManagerRow): DemoOverviewItem => ({
  id: row.id,
  name: row.title,
  product: row.category,
  status: toUiStatus(row),
  dbStatus: row.status,
  activeUsers: row.total_login_roles ?? 0,
  expiresIn: daysLeftLabel(row.expiry_date),
  createdBy: row.created_by ?? "—",
  region: row.tech_stack,
  usagePercent: Math.round(row.health_score ?? row.uptime_percentage ?? 0),
  url: row.url,
});

type DemoRequestRow = Awaited<ReturnType<typeof listPendingDemoRequests>>[number]["request"];

const priorityOf = (row: DemoRequestRow): DemoRequestItem["priority"] => {
  const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const ageDays = (Date.now() - created) / 86_400_000;
  if (ageDays >= 7) return "high";
  if (ageDays >= 2) return "medium";
  return "low";
};

const mapRequest = (row: DemoRequestRow, productName?: string): DemoRequestItem => ({
  id: row.id,
  company: row.company ?? row.requester_name,
  product: productName ?? "Unspecified",
  requestedBy: row.requester_name,
  priority: priorityOf(row),
  requestDate: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "—",
  status: row.status ?? "pending",
});

export const demosQueryKey = ["demo-manager", "demos"] as const;
export const demoRequestsQueryKey = ["demo-manager", "demo-requests"] as const;

export const useDemoOverview = () => {
  const queryClient = useQueryClient();

  const demosQuery = useQuery({
    queryKey: demosQueryKey,
    queryFn: async (): Promise<DemoOverviewItem[]> =>
      (await listManagedDemos({ data: { limit: 200 } })).map(mapDemo),
  });

  const requestsQuery = useQuery({
    queryKey: demoRequestsQueryKey,
    queryFn: async (): Promise<DemoRequestItem[]> =>
      (await listPendingDemoRequests()).map(({ request, productName }) =>
        mapRequest(request, productName ?? undefined),
      ),
  });

  const invalidateDemos = () => queryClient.invalidateQueries({ queryKey: demosQueryKey });
  const invalidateRequests = () =>
    queryClient.invalidateQueries({ queryKey: demoRequestsQueryKey });

  const setDemoStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DemoStatus }) =>
      setManagedDemoStatusFn({ data: { id, status } }),
    onSuccess: invalidateDemos,
  });

  const extendDemo = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      extendManagedDemo({ data: { id, days } }),
    onSuccess: invalidateDemos,
  });

  const cloneDemo = useMutation({
    mutationFn: (id: string) => cloneManagedDemo({ data: { id } }),
    onSuccess: invalidateDemos,
  });

  const respondToRequest = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      respondToDemoRequestFn({ data: { id, status } }),
    onSuccess: invalidateRequests,
  });

  const refresh = async () => {
    await Promise.all([invalidateDemos(), invalidateRequests()]);
  };

  return {
    demos: demosQuery.data ?? [],
    requests: requestsQuery.data ?? [],
    isLoading: demosQuery.isLoading || requestsQuery.isLoading,
    isDemosLoading: demosQuery.isLoading,
    isRequestsLoading: requestsQuery.isLoading,
    isFetching: demosQuery.isFetching || requestsQuery.isFetching,
    error: (demosQuery.error ?? requestsQuery.error) as Error | null,
    demosError: demosQuery.error as unknown,
    requestsError: requestsQuery.error as unknown,
    setDemoStatus,
    extendDemo,
    cloneDemo,
    respondToRequest,
    refresh,
  };
};

export default useDemoOverview;
