import type { DomainHealth } from "@/lib/founder/state.types";

/**
 * Types for the AI CEO module.
 *
 * Carried over from the imported module, with one deliberate change: every
 * figure on the ecosystem tiles is `number | null`. The module originally
 * produced these with Math.random(), so a tile could never be empty. Now they
 * are measured from the platform's own tables, and a measurement that has no
 * source yet is null rather than an invented number — the tile renders a dash
 * and says it is not tracked, which is the same convention the rest of the
 * dashboards use.
 */

export type SuggestionType = "growth" | "risk" | "cost" | "efficiency" | "product" | "compliance";

export type ImpactLevel = "high" | "medium" | "low";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "reviewed";

export interface CEOSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  /** 0–100. */
  confidence: number;
  impact: ImpactLevel;
  impactArea: string;
  status: SuggestionStatus;
  createdAt: string;
  /** `seed` marks advisory content shipped with the module, not AI output. */
  source: "AI-CEO" | "System" | "Analytics" | "seed";
}

export interface EcosystemMetrics {
  /** Platform events recorded in the last 24 hours. */
  systemActivityRate: number | null;
  /** No deployment record exists in the database yet. */
  deploymentFrequency: number | null;
  /** Failed API calls in the last hour. */
  errorVelocity: number | null;
  /** Accounts on the platform. */
  activeUsers: number | null;
  /** Orders placed since midnight UTC. */
  transactionsToday: number | null;
  /** Median latency in ms across recent upstream API calls. */
  apiLatency: number | null;
}

/** Where each tile's number came from, shown to the operator on hover. */
export type MetricSources = Record<keyof EcosystemMetrics, string>;

export interface AIObservation {
  id: string;
  category: "change" | "attention" | "revenue";
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  /** Already humanised, e.g. "15 min ago". */
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  type: "risk" | "revenue" | "operations" | "security" | "compliance";
  actor: string;
  action: string;
  target: string;
  /** Original timestamp, retained for sorting across sources. */
  occurredAt: string;
  timestamp: string;
  impact: "positive" | "negative" | "neutral";
}

/** One row of the AI decision history, from `ai_decision_logs`. */
export interface AIDecisionRecord {
  id: string;
  occurredAt: string;
  decision: string;
  confidence: number;
  inputSummary: string | null;
  outputSummary: string | null;
  outcome: string;
  tokens: number;
  costUsd: number;
  agentName: string | null;
  modelName: string | null;
}

/** Everything the dashboard needs, resolved on the server in one call. */
export interface MorningBriefCounts {
  agentRuns: number;
  failedAgentRuns: number;
  unverifiedAgentRuns: number;
  auditEvents: number;
  newLeads: number;
  newOrders: number;
  newTickets: number;
  openTickets: number;
  breachedTickets: number;
  overdueTasks: number;
  waitingDecisions: number;
}

export interface MorningBrief {
  id: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;
  summary: string;
  sourceCounts: MorningBriefCounts;
  sources: string[];
}

export interface MorningBriefTask {
  id: string;
  title: string;
  module: string | null;
  status: string;
  priority: string;
  severity: string;
  deadline: string | null;
}

export interface AyraMorningDashboard {
  brief: MorningBrief | null;
  /** Current open tasks read live from VPS; these are not part of the saved brief. */
  currentTasks: MorningBriefTask[];
}

export interface CEOState {
  /** True once the store has been read; the module has no offline mode. */
  persisted: boolean;
  suggestions: CEOSuggestion[];
  lastRefresh: string | null;
  metrics: EcosystemMetrics;
  metricSources: MetricSources;
  observations: AIObservation[];
  activityEvents: ActivityEvent[];
  companyHealth: DomainHealth[];
  decisions: AIDecisionRecord[];
  /** Set when a source could not be read, so the UI can say so honestly. */
  degraded: string[];
}
