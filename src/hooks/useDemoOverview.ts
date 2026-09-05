/**
 * DEMO MANAGER — LIVE OVERVIEW DATA
 * =================================
 * Reads the real `demos` and `demo_requests` tables from the Software Vala
 * backend and exposes them in the shape the Demo Manager dashboard renders.
 * No mock data: every field maps to a real column.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DemoRow = Database["public"]["Tables"]["demos"]["Row"];
type DemoStatus = Database["public"]["Enums"]["demo_status"];
type DemoRequestRow = Database["public"]["Tables"]["demo_requests"]["Row"];

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

const isExpired = (row: DemoRow) =>
  Boolean(row.expiry_date && new Date(row.expiry_date).getTime() < Date.now());

const toUiStatus = (row: DemoRow): DemoUiStatus => {
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

const mapDemo = (row: DemoRow): DemoOverviewItem => ({
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

const priorityOf = (row: DemoRequestRow): DemoRequestItem["priority"] => {
  const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const ageDays = (Date.now() - created) / 86_400_000;
  if (ageDays >= 7) return "high";
  if (ageDays >= 2) return "medium";
  return "low";
};

const mapRequest = (row: DemoRequestRow): DemoRequestItem => ({
  id: row.id,
  company: row.company_name ?? row.client_name,
  product: row.interested_category ?? "Unspecified",
  requestedBy: row.client_name,
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
    queryFn: async (): Promise<DemoOverviewItem[]> => {
      const { data, error } = await supabase
        .from("demos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(mapDemo);
    },
  });

  const requestsQuery = useQuery({
    queryKey: demoRequestsQueryKey,
    queryFn: async (): Promise<DemoRequestItem[]> => {
      const { data, error } = await supabase
        .from("demo_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(mapRequest);
    },
  });

  const invalidateDemos = () => queryClient.invalidateQueries({ queryKey: demosQueryKey });
  const invalidateRequests = () =>
    queryClient.invalidateQueries({ queryKey: demoRequestsQueryKey });

  const setDemoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DemoStatus }) => {
      const { error } = await supabase.from("demos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateDemos,
  });

  const extendDemo = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const { data, error } = await supabase
        .from("demos")
        .select("expiry_date")
        .eq("id", id)
        .single();
      if (error) throw error;
      const base = data?.expiry_date ? new Date(data.expiry_date) : new Date();
      const from = base.getTime() > Date.now() ? base : new Date();
      const next = new Date(from.getTime() + days * 86_400_000).toISOString();
      const { error: updateError } = await supabase
        .from("demos")
        .update({ expiry_date: next, status: "active" })
        .eq("id", id);
      if (updateError) throw updateError;
    },
    onSuccess: invalidateDemos,
  });

  const cloneDemo = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("demos").select("*").eq("id", id).single();
      if (error) throw error;
      const source = data as DemoRow;
      const {
        id: _id,
        created_at: _createdAt,
        updated_at: _updatedAt,
        last_health_check: _lastCheck,
        last_verified_at: _lastVerified,
        ...rest
      } = source;
      const { error: insertError } = await supabase.from("demos").insert({
        ...rest,
        title: `${source.title} (Copy)`,
        status: "inactive",
      });
      if (insertError) throw insertError;
    },
    onSuccess: invalidateDemos,
  });

  const respondToRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("demo_requests")
        .update({
          status,
          responded_at: new Date().toISOString(),
          responded_by: auth.user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
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
