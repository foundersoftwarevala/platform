import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  decideSuggestion,
  loadBossQueue,
  loadCeoState,
  refreshSignals,
  sendSuggestionToBoss,
} from "@/lib/ai-ceo/ceo.functions";
import type {
  ActivityEvent,
  AIDecisionRecord,
  AIObservation,
  CEOSuggestion,
  EcosystemMetrics,
  MetricSources,
} from "@/lib/ai-ceo/types";

export type {
  ActivityEvent,
  AIDecisionRecord,
  AIObservation,
  CEOSuggestion,
  EcosystemMetrics,
  MetricSources,
};

/**
 * The single data source for every AI CEO screen.
 *
 * The imported version of this hook held its own useState/useEffect, generated
 * metrics with Math.random() on a thirty-second timer, and kept a Map called
 * `localBossQueue` for when the API was unreachable — which it always was, so a
 * decision the Boss made lived only until the tab was closed.
 *
 * It now runs on React Query against real server functions, exactly like the
 * rest of the project's data hooks: one request fetches the stored suggestions
 * together with metrics, observations, activity and decision history measured
 * from the platform's own tables. Mutations write to the database and then
 * invalidate, so what is on screen is what was saved. There is no local
 * fallback queue — if a write fails the operator is told, rather than being
 * shown a success that only exists in the tab.
 *
 * The returned shape is kept identical to the original so the ten sections work
 * unchanged; `decisions`, `metricSources`, `degraded` and `refresh` are added.
 */

const EMPTY_METRICS: EcosystemMetrics = {
  systemActivityRate: null,
  deploymentFrequency: null,
  errorVelocity: null,
  activeUsers: null,
  transactionsToday: null,
  apiLatency: null,
};

export function useCEOSuggestions() {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(loadCeoState);
  const fetchQueue = useServerFn(loadBossQueue);
  const doRefresh = useServerFn(refreshSignals);
  const doSend = useServerFn(sendSuggestionToBoss);
  const doDecide = useServerFn(decideSuggestion);

  const state = useQuery({
    queryKey: ["ai-ceo", "state"],
    queryFn: () => fetchState(),
    // The live figures move; a minute is long enough to avoid hammering the
    // database and short enough that the dashboard is not stale.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["ai-ceo"] }),
    [queryClient],
  );

  const refreshMutation = useMutation({
    mutationFn: () => doRefresh({ data: undefined }),
    onSuccess: () => {
      void invalidate();
    },
    onError: (error: unknown) => {
      toast.error("Could not refresh", {
        description: error instanceof Error ? error.message : "The live sources did not answer.",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => doSend({ data: { id } }),
    onSuccess: (result, id) => {
      const title = state.data?.suggestions.find((s) => s.id === id)?.title ?? "Suggestion";
      if (result.ok) {
        toast.success("Sent to the Boss", {
          description: `"${title}" is now waiting for a decision.`,
        });
        void invalidate();
      } else {
        toast.error("Not sent", { description: result.error ?? "The write was refused." });
      }
    },
    onError: (error: unknown) => {
      toast.error("Not sent", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      });
    },
  });

  const decideMutation = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected" }) =>
      doDecide({ data: input }),
    onSuccess: (result, input) => {
      if (result.ok) {
        toast.success(`Suggestion ${input.decision}`, {
          description: "The decision is recorded and the AI CEO queue is updated.",
        });
        void invalidate();
      } else {
        toast.error("Decision not saved", {
          description: result.error ?? "The write was refused.",
        });
      }
    },
    onError: (error: unknown) => {
      toast.error("Decision not saved", {
        description: error instanceof Error ? error.message : "The server refused the request.",
      });
    },
  });

  const data = state.data;
  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);
  const observations = useMemo(() => data?.observations ?? [], [data]);
  const activityEvents = useMemo(() => data?.activityEvents ?? [], [data]);
  const decisions = useMemo(() => data?.decisions ?? [], [data]);

  const getObservationsByCategory = useCallback(
    (category: AIObservation["category"]) => observations.filter((o) => o.category === category),
    [observations],
  );

  const getEventsByType = useCallback(
    (type?: ActivityEvent["type"]) =>
      !type ? activityEvents : activityEvents.filter((e) => e.type === type),
    [activityEvents],
  );

  /** The Boss queue is read on demand; it changes only when someone acts. */
  const getBossSuggestions = useCallback(async (): Promise<CEOSuggestion[]> => {
    const result = await queryClient.fetchQuery({
      queryKey: ["ai-ceo", "boss-queue"],
      queryFn: () => fetchQueue(),
      staleTime: 15_000,
    });
    return result.suggestions;
  }, [queryClient, fetchQueue]);

  const sendToBoss = useCallback(
    async (id: string) => {
      const result = await sendMutation.mutateAsync(id).catch(() => null);
      return Boolean(result?.ok);
    },
    [sendMutation],
  );

  const acknowledgeSuggestion = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      const result = await decideMutation.mutateAsync({ id, decision }).catch(() => null);
      return Boolean(result?.ok);
    },
    [decideMutation],
  );

  return {
    suggestions,
    ecosystemMetrics: data?.metrics ?? (state.isLoading ? null : EMPTY_METRICS),
    metricSources: data?.metricSources as MetricSources | undefined,
    observations,
    activityEvents,
    decisions,
    /** Live sources that did not answer on this load. */
    degraded: data?.degraded ?? [],
    isLoading: state.isLoading,
    isError: state.isError,
    error: state.error,
    /** Kept for the imported sections; the module always persists now. */
    isPersisted: data?.persisted ?? false,
    lastRefresh: data?.lastRefresh ? new Date(data.lastRefresh) : null,
    isRefreshing: refreshMutation.isPending,
    refresh: () => refreshMutation.mutate(),
    retry: () => void state.refetch(),
    sendToBoss,
    isSending: sendMutation.isPending,
    getBossSuggestions,
    acknowledgeSuggestion,
    isDeciding: decideMutation.isPending,
    getObservationsByCategory,
    getEventsByType,
  };
}
