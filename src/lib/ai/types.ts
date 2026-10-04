export type AiProject = {
  id: string;
  title: string;
  url: string | null;
  status: "active" | "building" | "paused";
  stack: string;
  lastDeploy: string;
};
export type AiPrompt = {
  id: string;
  projectTitle: string | null;
  role: "user" | "assistant";
  content: string;
  language: string | null;
  model: string | null;
  tokens: number | null;
  createdAt: string;
};
export type AiExecutionLog = {
  id: string;
  projectTitle: string | null;
  command: string;
  status: "success" | "error" | "warning";
  durationMs: number | null;
  createdAt: string;
};
export type AiModelRow = {
  id: string;
  name: string;
  provider: string | null;
  modelId: string | null;
  status: string;
  requests: number;
  latencyMs: number | null;
  load: number | null;
};
export type AiCredits = {
  balance: number | null;
  runwayDays: number | null;
  todayUsage: number;
  monthUsage: number;
  unpricedToday: number;
  unpricedMonth: number;
};
export type AiSetting = {
  id: string;
  key: string;
  label: string;
  value: string;
  value_type: string;
  description: string | null;
};
export type AiIssue = {
  id: string;
  category: string;
  label: string;
  severity: "critical" | "warning";
  count: number;
  detail: string | null;
};
export type AiSnapshot = {
  id: string;
  label: string;
  projectTitle: string | null;
  sizeKb: number | null;
  createdAt: string;
};
export type AiLockState = {
  locked: boolean;
  reason: string | null;
  changedBy: string | null;
  updatedAt: string | null;
};
/** "postgres": live rows (possibly none). "unavailable": the store could not be read. */
export type AiDataSource = "postgres" | "unavailable";
export type Sourced<T> = { source: AiDataSource; data: T; available: boolean; reason?: string };
