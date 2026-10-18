import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Real dashboard figures for the influencer who is signed in.
 *
 * The influencer portal drew its KPI cards from the seeded generator in
 * lib/metrics.ts, so every influencer account saw the same invented followers,
 * campaigns and revenue while their real rows sat in the influencer tables that
 * Influencer Manager operates. This reads those same rows, scoped to the one
 * person, through /api/influencer/metrics.
 *
 * Built the same way as useSellerMetrics, which does this for vendors and
 * authors - same shape, same honesty about what is missing.
 */

export type InfluencerMetrics = {
  profile: {
    id: string;
    full_name: string | null;
    status: string;
    niche: string | null;
    country: string | null;
    since: string;
  };
  metrics: Record<string, number | null>;
};

async function fetchInfluencerMetrics(): Promise<InfluencerMetrics | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const response = await fetch("/api/influencer/metrics", {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 403 means this account is signed in but holds no influencer profile. That
  // is a real answer, not an error: the dashboard shows dashes.
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Could not load your dashboard figures");
  return (await response.json()) as InfluencerMetrics;
}

export function useInfluencerMetrics(role: string) {
  const enabled = role === "influencer";
  const query = useQuery({
    queryKey: ["influencer-metrics"],
    queryFn: fetchInfluencerMetrics,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  if (!enabled) return { values: undefined, profile: null, loading: false };

  // While loading, the sample engine is left alone rather than flashing dashes.
  // Once the answer is in, every card reads from it - and a card the platform
  // has no source for reads "not tracked yet" instead of borrowing a number.
  const values = query.data?.metrics ?? (query.isLoading ? undefined : {});
  return { values, profile: query.data?.profile ?? null, loading: query.isLoading };
}
