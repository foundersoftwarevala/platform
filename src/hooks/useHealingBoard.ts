import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  loadHealingBoard,
  type HealingBoard,
  type HealingBudget,
  type HealingSelfCheck,
  type HealingTotals,
  type TimelineRow,
} from "@/lib/founder/healing/healing.functions";

export type { HealingBoard, HealingBudget, HealingSelfCheck, HealingTotals, TimelineRow };

/**
 * The self-healing board.
 *
 * `totals` and `selfCheck` are kept as null when the read failed rather than
 * flattened to zeros. That distinction is the whole reason the screen can
 * say "data unavailable" instead of drawing an all-clear it never
 * established — and an all-clear that is really a failed query is the most
 * dangerous thing an operations dashboard can show.
 */
export function useHealingBoard() {
  const load = useServerFn(loadHealingBoard);

  const result = useQuery({
    queryKey: ["founder", "healing-board"],
    queryFn: () => load(),
    // Healing state changes when a worker runs, not continuously. Polling
    // harder would cost more than it tells anyone.
    staleTime: 30_000,
  });

  const board = result.data as HealingBoard | undefined;
  const reason = result.error instanceof Error ? result.error.message : "";
  const denied = /permission|authentication|authorization|forbidden/i.test(reason);

  return {
    totals: board?.totals ?? null,
    selfCheck: board?.selfCheck ?? null,
    budgets: board?.budgets ?? [],
    timeline: board?.timeline ?? [],
    degraded: board?.degraded ?? [],
    isLoading: result.isLoading,
    failed: result.isError && !denied,
    denied,
    refetch: result.refetch,
  };
}
