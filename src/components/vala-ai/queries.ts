import { queryOptions } from "@tanstack/react-query";
import {
  getAiCredits,
  getAiIssues,
  getAiLockState,
  getAiLogs,
  getAiModels,
  getAiProjects,
  getAiPrompts,
  getAiSettings,
  getAiSnapshots,
} from "@/lib/ai/ai.functions";

export const projectsQuery = queryOptions({ queryKey: ["ai", "projects"], queryFn: () => getAiProjects() });
export const promptsQuery = queryOptions({ queryKey: ["ai", "prompts"], queryFn: () => getAiPrompts() });
export const logsQuery = queryOptions({ queryKey: ["ai", "logs"], queryFn: () => getAiLogs() });
export const modelsQuery = queryOptions({ queryKey: ["ai", "models"], queryFn: () => getAiModels() });
export const creditsQuery = queryOptions({ queryKey: ["ai", "credits"], queryFn: () => getAiCredits() });
export const settingsQuery = queryOptions({ queryKey: ["ai", "settings"], queryFn: () => getAiSettings() });
export const issuesQuery = queryOptions({ queryKey: ["ai", "issues"], queryFn: () => getAiIssues() });
export const lockQuery = queryOptions({ queryKey: ["ai", "lock"], queryFn: () => getAiLockState() });
export const snapshotsQuery = queryOptions({ queryKey: ["ai", "snapshots"], queryFn: () => getAiSnapshots() });
