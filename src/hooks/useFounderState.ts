import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { loadFounderState } from "@/lib/founder/founder.functions";
import type { OperatingState } from "@/lib/founder/state.types";

export type { OperatingState };

/**
 * The Company Operating State, as a screen reads it.
 *
 * This adds no data source. `loadFounderState` already assembles goals, KPIs,
 * risks, attention, deadlines, health and pending approvals from the founder
 * tables, each carrying where it came from and when it was measured; this is
 * only the React Query wrapper that was missing, so the Command Center can
 * show that work instead of it being reachable by nothing.
 *
 * Loading, failed and answered are kept apart, as they are everywhere else in
 * this module. An empty state is a fact — nothing needs attention — while a
 * failed read means we do not know, and the two must never draw the same.
 */
export function useFounderState() {
  const load = useServerFn(loadFounderState);

  const result = useQuery({
    queryKey: ["founder", "state"],
    queryFn: () => load(),
    // The operating state is rebuilt from live tables on every call, so this
    // is a short window purely to stop tab-switching from re-reading it.
    staleTime: 30_000,
  });

  const state = result.data as OperatingState | undefined;

  // "You may not see this" and "this could not be read" are different answers
  // and must not draw the same. loadFounderState refuses anyone who is not
  // boss or admin, and that refusal is an expected state, not a fault.
  const reason = result.error instanceof Error ? result.error.message : "";
  const denied = /permission|authentication|authorization|forbidden/i.test(reason);

  return {
    state: state ?? null,
    attention: state?.attention ?? [],
    kpis: state?.kpis ?? [],
    risks: state?.risks ?? [],
    health: state?.health ?? [],
    pendingApprovals: state?.pendingApprovals ?? [],
    deadlines: state?.deadlines ?? [],
    sources: state?.sources ?? {},
    degraded: state?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError && !denied,
    denied,
    reason,
    refetch: result.refetch,
  };
}
