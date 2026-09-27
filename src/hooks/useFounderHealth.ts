import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  loadFounderOperationalHealth,
  type OperationalHealth,
} from "@/lib/founder/monitoring/monitoring.functions";

export type { OperationalHealth };

/**
 * Founder AI's own health.
 *
 * Null is the important case and is preserved rather than flattened to zeros:
 * a panel showing all zeros because it could not look is worse than one that
 * says it could not look, and the two are indistinguishable once a null has
 * been turned into a 0.
 */
export function useFounderHealth() {
  const load = useServerFn(loadFounderOperationalHealth);

  const result = useQuery({
    queryKey: ["founder", "health"],
    queryFn: () => load(),
    staleTime: 30_000,
  });

  return {
    health: (result.data as OperationalHealth | null | undefined) ?? null,
    isLoading: result.isLoading,
    failed: result.isError,
    refetch: result.refetch,
  };
}
