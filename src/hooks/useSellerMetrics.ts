import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Real dashboard figures for the roles that sell on the marketplace.
 *
 * A vendor and an author are the same thing underneath: both own a
 * `marketplace_sellers` record, and both sell `marketplace_products`. So both
 * dashboards read the same endpoint, which counts from the database rather
 * than generating numbers.
 *
 * Roles without a seller identity are not asked for, so their dashboards are
 * left exactly as they were.
 */

export const SELLER_ROLES = ["vendor", "author", "reseller"] as const;

export function isSellerRole(role: string): boolean {
  return (SELLER_ROLES as readonly string[]).includes(role);
}

export type SellerMetrics = {
  seller?: { id: string; display_name: string | null; status: string; currency: string };
  reseller?: { id: string; name: string | null; code: string | null; status: string };
  metrics: Record<string, number | null>;
};

async function fetchSellerMetrics(role: string): Promise<SellerMetrics | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const endpoint = role === "reseller" ? "/api/reseller/metrics" : "/api/seller/metrics";
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 403 means this account is signed in but is not a seller. That is a real
  // answer, not an error: the dashboard shows dashes rather than a failure.
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Could not load your dashboard figures");
  return (await response.json()) as SellerMetrics;
}

export function useSellerMetrics(role: string) {
  const enabled = isSellerRole(role);
  const query = useQuery({
    queryKey: ["seller-metrics", role],
    queryFn: () => fetchSellerMetrics(role),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  if (!enabled) return { values: undefined, seller: null, loading: false };

  // While loading, and for a signed-in account with no seller record, every
  // metric reads as "not tracked yet" rather than borrowing a generated number.
  const values = query.data?.metrics ?? (query.isLoading ? undefined : {});
  return {
    values,
    seller: query.data?.seller ?? query.data?.reseller ?? null,
    loading: query.isLoading,
  };
}
