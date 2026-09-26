/**
 * Types for the AI CEO's operational screens.
 *
 * The imported module carried agents, tasks, automations, notifications,
 * usage, security and insights as hardcoded arrays inside each component, with
 * an `AGENTS_RUNTIME_API_REQUIRED` note explaining that nothing was connected.
 * Every record below is instead read from a table this platform already has,
 * so a screen that is empty is empty because the table is, which is a fact
 * worth showing rather than one worth papering over.
 *
 * Where a figure has no source at all it is `null`, the same convention the
 * ecosystem tiles use.
 */

/** A registered AI agent, from `ai_agents`. */
export interface CEOAgent {
  id: string;
  name: string;
  purpose: string | null;
  status: string;
  modelId: string | null;
  /** Runs recorded over the last thirty days; null when never measured. */
  runs30d: number | null;
  /** 0–100. Null when the agent has no completed run to measure. */
  successRate: number | null;
  tools: string[];
  maxTokens: number | null;
  createdAt: string | null;
}

/** A unit of work, from `tm_tasks`. */
export interface CEOTask {
  id: string;
  code: string | null;
  title: string;
  module: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  assignedTo: string | null;
  clientName: string | null;
  estimatedHours: number | null;
  actualMinutes: number | null;
  slaHours: number | null;
  promisedAt: string | null;
}

/**
 * An automation rule.
 *
 * Four tables hold these — `automation_rules`, `marketing_automations`,
 * `seo_automations` and `tm_automations` — because four managers each grew
 * their own. They are shown together here with the owning table named, which
 * is the only honest way to present one list over four sources.
 */
export interface CEOAutomation {
  id: string;
  name: string;
  description: string | null;
  trigger: string | null;
  action: string | null;
  enabled: boolean;
  runCount: number | null;
  lastRunAt: string | null;
  /** The table this row came from, so a reader can go and find it. */
  source: string;
}

/** A notification raised to an operator, from `notifications`. */
export interface CEONotification {
  id: string;
  title: string;
  body: string | null;
  kind: string | null;
  readAt: string | null;
  createdAt: string | null;
}

/** A day of paid API consumption, from `finance_ai_api_usage` and `usage_daily`. */
export interface CEOUsageRow {
  id: string;
  day: string;
  provider: string;
  service: string | null;
  requests: number | null;
  tokens: number | null;
  costUsd: number | null;
  source: string;
}

/** A security signal, from `security_alerts` and `security_findings`. */
export interface CEOSecurityRow {
  id: string;
  title: string;
  severity: string;
  category: string | null;
  status: string | null;
  detectedAt: string | null;
  description: string | null;
  source: string;
}

/** An AI-produced insight, from `promise_ai_insights` and `server_ai_insights`. */
export interface CEOInsight {
  id: string;
  title: string;
  detail: string | null;
  recommendation: string | null;
  severity: string;
  /** 0–100 where the producing system recorded one. */
  confidence: number | null;
  status: string | null;
  createdAt: string | null;
  source: string;
}

/** Totals for the tiles above each operational list. */
export interface CEOOpsSummary {
  agents: number | null;
  agentsActive: number | null;
  tasks: number | null;
  tasksOpen: number | null;
  automations: number | null;
  automationsEnabled: number | null;
  notificationsUnread: number | null;
  securityOpen: number | null;
  /** Cost in USD across every paid API row held, or null when nothing is recorded. */
  spendUsd: number | null;
}

/** Everything the operational screens need, resolved on the server in one call. */
export interface CEOOpsState {
  summary: CEOOpsSummary;
  agents: CEOAgent[];
  tasks: CEOTask[];
  automations: CEOAutomation[];
  notifications: CEONotification[];
  usage: CEOUsageRow[];
  security: CEOSecurityRow[];
  insights: CEOInsight[];
  /** Names the table behind each list, shown under the heading. */
  sources: Record<string, string>;
  /** Any source that could not be read at all. */
  degraded: string[];
}
