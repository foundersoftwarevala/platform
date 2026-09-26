import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { loadCeoOps } from "@/lib/ai-ceo/ceo.functions";
import type {
  CEOAgent,
  CEOAutomation,
  CEOInsight,
  CEONotification,
  CEOOpsState,
  CEOOpsSummary,
  CEOSecurityRow,
  CEOTask,
  CEOUsageRow,
} from "@/lib/ai-ceo/ops.types";

export type {
  CEOAgent,
  CEOAutomation,
  CEOInsight,
  CEONotification,
  CEOOpsState,
  CEOOpsSummary,
  CEOSecurityRow,
  CEOTask,
  CEOUsageRow,
};

const EMPTY_SUMMARY: CEOOpsSummary = {
  agents: null,
  agentsActive: null,
  tasks: null,
  tasksOpen: null,
  automations: null,
  automationsEnabled: null,
  notificationsUnread: null,
  securityOpen: null,
  spendUsd: null,
};

/**
 * The single data source for the AI CEO's operational screens.
 *
 * One request brings back agents, tasks, automations, notifications, usage,
 * security signals and AI insights, each read from a table the platform
 * already has. It mirrors useCEOSuggestions deliberately: same React Query
 * conventions, same honest `degraded` list, so a screen can say which source
 * failed rather than rendering an empty list as though it were an answer.
 *
 * `loading` and `failed` are kept apart on purpose. An empty list means the
 * table is empty, which is a fact; a failed read means we do not know, which
 * is a different claim and must never be drawn as "none".
 */
export function useCEOOps() {
  const fetchOps = useServerFn(loadCeoOps);

  const query = useQuery({
    queryKey: ["ai-ceo", "ops"],
    queryFn: () => fetchOps(),
    staleTime: 30_000,
  });

  const data = query.data as CEOOpsState | undefined;

  return {
    summary: data?.summary ?? EMPTY_SUMMARY,
    agents: data?.agents ?? [],
    tasks: data?.tasks ?? [],
    automations: data?.automations ?? [],
    notifications: data?.notifications ?? [],
    usage: data?.usage ?? [],
    security: data?.security ?? [],
    insights: data?.insights ?? [],
    sources: data?.sources ?? {},
    degraded: data?.degraded ?? [],
    isLoading: query.isLoading,
    failed: query.isError,
    refetch: query.refetch,
  };
}
