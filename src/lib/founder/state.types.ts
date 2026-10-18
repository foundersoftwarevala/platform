/**
 * The Company Operating State: what is true about the company right now.
 *
 * One idea shapes every type here. A fact that Founder AI will reason from
 * carries where it came from, when it was true, how it was arrived at and how
 * much that is worth — because a console that cannot tell a measured number
 * from an assumed one will eventually be used to make a decision on an assumed
 * one.
 *
 * The second idea is that "we do not know" is a value, not a gap. Nothing here
 * defaults a missing measurement to zero. `Fact<T>` with confidence UNKNOWN and
 * a null value is how the model says so, and every consumer has to handle it,
 * which is the point.
 */

export type Confidence = "MEASURED" | "ESTIMATED" | "STALE" | "UNKNOWN";
export type Health = "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL" | "UNKNOWN";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Freshness = "FRESH" | "AGEING" | "STALE" | "UNKNOWN";
export type ActorKind = "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL";

/** The business lenses Founder AI reasons through. Development is not one. */
export const DOMAINS = [
  "EXECUTIVE",
  "SALES_OPERATIONS",
  "CUSTOMER_OPERATIONS",
  "PRODUCT_OPERATIONS",
  "MARKETPLACE_OPERATIONS",
  "FINANCE_OPERATIONS",
  "MARKETING_OPERATIONS",
  "SUPPORT_OPERATIONS",
  "SECURITY_RISK_OPERATIONS",
  "PEOPLE_OPERATIONS",
  "VENDOR_PARTNER_OPERATIONS",
  "RESEARCH_STRATEGY",
] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * A value together with everything needed to judge it.
 *
 * `value` may be null. That is not an error state: it means nothing was
 * measured, and `confidence` says whether that is because there was nothing to
 * measure or because nobody looked.
 */
export interface Fact<T> {
  value: T | null;
  /** When the underlying thing was true, not when we asked. */
  measuredAt: string | null;
  /** The table, query or endpoint this came from, in words a person can check. */
  source: string;
  /** How it was arrived at: counted, summed, derived from X. */
  method: string;
  confidence: Confidence;
  freshness: Freshness;
}

export interface Goal {
  id: string;
  title: string;
  domain: string;
  ownerName: string | null;
  targetOn: string | null;
  status: string;
  priority: number;
  progress: number | null;
  health: Health;
  objectives: Objective[];
}

export interface Objective {
  id: string;
  title: string;
  status: string;
  priority: number;
  progress: number | null;
  health: Health;
}

export interface Kpi {
  id: string;
  key: string;
  name: string;
  definition: string;
  unit: string;
  domain: string;
  source: string;
  target: number | null;
  baseline: number | null;
  /** The latest reading, with its provenance intact. */
  current: Fact<number>;
  /** Derived from the KPI's own thresholds, never typed in by hand. */
  status: Health;
  /** Why the status is what it is, in words. */
  statusReason: string;
  higherIsBetter: boolean;
}

export interface Initiative {
  id: string;
  title: string;
  domain: string | null;
  ownerName: string | null;
  status: string;
  priority: number;
  targetOn: string | null;
  progress: number | null;
  health: Health;
  milestones: Milestone[];
  /** Tasks linked from the task manager; the task manager still owns them. */
  taskIds: string[];
}

export interface Milestone {
  id: string;
  title: string;
  dueOn: string | null;
  status: string;
  blockedReason: string | null;
  hasEvidence: boolean;
}

export interface Risk {
  id: string;
  title: string;
  domain: string;
  severity: Severity;
  likelihood: number | null;
  status: string;
  source: string;
  detectedAt: string;
}

export interface AttentionItem {
  id: string;
  kind: string;
  domain: string;
  title: string;
  reason: string;
  severity: Severity;
  priority: number;
  status: string;
  sourceSystem: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

/**
 * A deadline, with the reason it is or is not safe.
 *
 * "Due tomorrow" is not the useful sentence. "Due tomorrow and blocked on a
 * task that has not started" is, and it can only be said by reading the
 * dependency graph alongside the date.
 */
export interface Deadline {
  id: string;
  title: string;
  dueOn: string;
  kind: "task" | "milestone";
  status: string;
  /** OVERDUE, DUE_SOON, AT_RISK, SCHEDULED, DONE. */
  state: string;
  /** Why it is in that state — the dependency or block that decides it. */
  reason: string;
  blockedBy: string[];
}

export interface WorkloadEntry {
  ownerId: string | null;
  ownerName: string;
  department: string | null;
  assigned: number;
  active: number;
  blocked: number;
  overdue: number;
  /** Null where no capacity has ever been recorded for this person. */
  capacityHours: number | null;
  estimatedHours: number | null;
  state: "OVERLOADED" | "AVAILABLE" | "BALANCED" | "UNKNOWN";
}

export interface DomainHealth {
  domain: Domain;
  health: Health;
  /** What decided it. An unexplained health light is a decoration. */
  reason: string;
  openAttention: number;
  criticalAttention: number;
  kpisAtRisk: number;
}

export interface OperationalEvent {
  id: string;
  eventType: string;
  domain: string;
  severity: Severity;
  occurredAt: string;
  receivedAt: string;
  sourceSystem: string;
  entityType: string | null;
  entityId: string | null;
  actorKind: ActorKind;
}

export interface PendingApproval {
  id: string;
  title: string;
  sourceSystem: string;
  requestedAt: string | null;
  status: string;
}

/** The whole picture, as one answer. */
export interface OperatingState {
  /** This platform is a single company; no organisation model is invented. */
  organization: { name: string; tenancy: "SINGLE_TENANT"; organizationId: string | null };
  builtAt: string;
  goals: Goal[];
  kpis: Kpi[];
  initiatives: Initiative[];
  risks: Risk[];
  attention: AttentionItem[];
  deadlines: Deadline[];
  workload: WorkloadEntry[];
  health: DomainHealth[];
  recentEvents: OperationalEvent[];
  pendingApprovals: PendingApproval[];
  /** Per-source freshness, so a reader can see what part of this is old. */
  sources: Record<string, { source: string; measuredAt: string | null; freshness: Freshness }>;
  /** Any source that could not be read at all. Never silently empty. */
  degraded: string[];
}

/** How stale is too stale. Anything older than a day stops being current. */
export function freshnessOf(measuredAt: string | null, staleAfterHours = 24): Freshness {
  if (!measuredAt) return "UNKNOWN";
  const at = new Date(measuredAt).getTime();
  if (!Number.isFinite(at)) return "UNKNOWN";
  const hours = (Date.now() - at) / 3_600_000;
  if (hours <= staleAfterHours / 4) return "FRESH";
  if (hours <= staleAfterHours) return "AGEING";
  return "STALE";
}

/** A fact nobody has measured. Used instead of a zero. */
export function unknownFact<T>(source: string, method: string): Fact<T> {
  return {
    value: null,
    measuredAt: null,
    source,
    method,
    confidence: "UNKNOWN",
    freshness: "UNKNOWN",
  };
}

/** A fact read from a real source. Downgraded to STALE when it is too old. */
export function measuredFact<T>(
  value: T | null,
  measuredAt: string | null,
  source: string,
  method: string,
  staleAfterHours = 24,
): Fact<T> {
  if (value === null) return unknownFact<T>(source, method);
  const freshness = freshnessOf(measuredAt, staleAfterHours);
  return {
    value,
    measuredAt,
    source,
    method,
    confidence: freshness === "STALE" ? "STALE" : "MEASURED",
    freshness,
  };
}
