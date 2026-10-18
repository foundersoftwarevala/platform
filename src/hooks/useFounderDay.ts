import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n/use-translation";

import {
  closeFounderMorningCycle,
  loadFounderDay,
  runFounderMorningCycle,
  type DayView,
  type PlanItem,
} from "@/lib/founder/morning/morning.functions";

export type { DayView, PlanItem };

/**
 * The operational day, as the Morning AI screen reads it.
 *
 * A day with no cycle and a day whose cycle found nothing are different
 * things and are kept apart here: the first offers to run one, the second
 * says the company had nothing outstanding. Drawing them the same would make
 * "we have not looked" indistinguishable from "there is nothing".
 */
export function useFounderDay() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const load = useServerFn(loadFounderDay);
  const run = useServerFn(runFounderMorningCycle);
  const close = useServerFn(closeFounderMorningCycle);

  const result = useQuery({
    queryKey: ["founder", "day"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["founder", "day"] });
  };

  const runCycle = useMutation({
    mutationFn: () => run(),
    onSuccess: (raw) => {
      const response = raw as
        { ok?: boolean; planned?: number; unallocated?: number; error?: string } | undefined;
      if (!response?.ok) {
        toast.error(response?.error ?? "The day could not be planned");
        return;
      }
      // A plan of nothing is a real answer, and says so rather than being
      // announced as a success with no detail.
      toast.success(
        response.planned === 0
          ? t("ceo.morning_nothing_to_plan")
          : `${response.planned} item(s) planned` +
              (response.unallocated ? `, ${response.unallocated} with no eligible agent` : ""),
      );
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The day could not be planned"),
  });

  const closeCycle = useMutation({
    mutationFn: (cycleId: string) => close({ data: { cycleId } }),
    onSuccess: (raw) => {
      const response = raw as { ok?: boolean; error?: string } | undefined;
      if (!response?.ok) {
        toast.error(response?.error ?? "The day could not be closed");
        return;
      }
      toast.success(t("ceo.morning_closed"));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The day could not be closed"),
  });

  const day = result.data as DayView | undefined;
  const reason = result.error instanceof Error ? result.error.message : "";
  const denied = /permission|authentication|authorization|forbidden/i.test(reason);

  return {
    day: day ?? null,
    isLoading: result.isLoading,
    failed: result.isError && !denied,
    denied,
    refetch: result.refetch,
    runCycle: runCycle.mutateAsync,
    isRunning: runCycle.isPending,
    closeCycle: closeCycle.mutateAsync,
    isClosing: closeCycle.isPending,
  };
}
