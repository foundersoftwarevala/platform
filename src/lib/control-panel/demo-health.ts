import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * The live demo URLs and how each answered its last health check, for the
 * Command Center.
 *
 * The Command Center's demo widgets read a browser-storage store seeded with
 * three invented products and demo logins, so "Demo Server Health" described
 * software that does not exist. This reads `product_demo_urls` - the demos the
 * marketplace actually opens - and the result of the platform's own checks on
 * them. Login details are never selected.
 */

export type DemoHealth = "working" | "slow" | "offline" | "unknown";

export type DemoHealthRow = {
  id: string;
  demoName: string;
  active: boolean;
  lastChecked: string | null;
  responseTimeMs: number | null;
  httpStatus: number | null;
  ssl: boolean | null;
  health: DemoHealth;
};

/** Slower than this at its last check counts as slow. */
const SLOW_MS = 3000;

function healthOf(row: {
  last_checked_at: string | null;
  last_http_status: number | null;
  last_response_ms: number | null;
}): DemoHealth {
  if (!row.last_checked_at) return "unknown";
  const status = row.last_http_status ?? 0;
  if (status < 200 || status >= 400) return "offline";
  return (row.last_response_ms ?? 0) >= SLOW_MS ? "slow" : "working";
}

export function useDemoHealth() {
  const query = useQuery({
    queryKey: ["control-panel", "demo-health"],
    queryFn: async () => {
      const [demos, products] = await Promise.all([
        supabase
          .from("product_demo_urls")
          .select("id,demo_name,status,last_checked_at,last_response_ms,last_http_status,ssl_valid")
          .order("demo_name", { ascending: true }),
        supabase
          .from("marketplace_products")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
      ]);
      if (demos.error) throw demos.error;
      if (products.error) throw products.error;
      return {
        demos: (demos.data ?? []).map(
          (row): DemoHealthRow => ({
            id: row.id,
            demoName: row.demo_name ?? "",
            active: row.status === "active",
            lastChecked: row.last_checked_at,
            responseTimeMs: row.last_response_ms,
            httpStatus: row.last_http_status,
            ssl: row.ssl_valid,
            health: healthOf(row),
          }),
        ),
        productCount: products.count ?? 0,
      };
    },
    refetchInterval: 120_000,
  });
  return {
    demos: query.data?.demos ?? [],
    productCount: query.data?.productCount ?? null,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
