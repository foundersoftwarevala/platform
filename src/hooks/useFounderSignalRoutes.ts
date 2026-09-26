import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { loadFounderSignalRoutes } from "@/lib/founder/monitoring/monitoring.functions";
import type { SignalRoute } from "@/lib/founder/monitoring/signals.server";

export type { SignalRoute };

/**
 * The severity ladder, as it is actually configured.
 *
 * It is read rather than written into the screen, because the ladder lives in
 * founder_signal_routes precisely so it can be changed without a deployment.
 * A screen that hardcoded it would start lying the first time somebody did.
 */
export function useFounderSignalRoutes() {
  const load = useServerFn(loadFounderSignalRoutes);

  const result = useQuery({
    queryKey: ["founder", "signal-routes"],
    queryFn: () => load(),
    // The ladder changes rarely; re-reading it on every visit is waste.
    staleTime: 300_000,
  });

  return {
    routes: (result.data as SignalRoute[] | undefined) ?? [],
    isLoading: result.isLoading,
    failed: result.isError,
  };
}
