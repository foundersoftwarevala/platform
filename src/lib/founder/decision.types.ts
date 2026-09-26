import type { Confidence, Domain, Severity } from "./state.types";

/**
 * The Decision Engine's vocabulary.
 *
 * A decision is a record with a lifecycle, not an answer. The types below are
 * shaped so that the things which must never be confused cannot be: an
 * inference is a different kind from a fact, a confidence score cannot exist
 * without the factors that produced it, and an impact nobody could estimate is
 * null rather than a number that looks estimated.
 */

export type DecisionState =
  | "DETECTED"
  | "CONTEXT_BUILDING"
  | "ANALYZING"
  | "OPTIONS_READY"
  | "RECOMMENDATION_READY"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "VERIFICATION"
  | "VERIFIED"
  | "FAILED"
  | "ESCALATED"
  | "CANCELLED"
  | "CLOSED";

export type EvidenceKind =
  "FACT" | "OBSERVATION" | "CALCULATION" | "ASSUMPTION" | "INFERENCE" | "RECOMMENDATION";

/** Why a decision could not be made on what was available. */
export type EvidenceGap =
  "NONE" | "UNKNOWN" | "INSUFFICIENT_DATA" | "STALE_DATA" | "CONFLICTING_DATA";

export type ApprovalState =
  "REQUESTED" | "VIEWED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "EXPIRED" | "CANCELLED";

/**
 * What an AI-originated action is allowed to be.
 *
 * EXECUTE exists so later orchestration has a name for it. Nothing in this
 * module issues one: Founder AI reads, analyses, recommends, asks and records.
 */
export type ActionClass =
  | "READ"
  | "ANALYZE"
  | "RECOMMEND"
  | "REQUEST_APPROVAL"
  | "APPROVE"
  | "EXECUTE"
  | "VERIFY"
  | "AUDIT";

export type RiskState =
  "IDENTIFIED" | "ASSESSED" | "MITIGATING" | "MONITORING" | "RESOLVED" | "ACCEPTED" | "ESCALATED";

/** The decision types this platform actually has domains for. */
export const DECISION_TYPES = [
  "OPERATIONAL",
  "FINANCIAL_OPERATIONAL",
  "CUSTOMER_OPERATIONAL",
  "SALES_OPERATIONAL",
  "MARKETING_OPERATIONAL",
  "SUPPORT_OPERATIONAL",
  "MARKETPLACE_OPERATIONAL",
  "PRODUCT_OPERATIONAL",
  "RISK",
  "COMPLIANCE",
  "RESOURCE_ALLOCATION",
  "PRIORITY",
  "ESCALATION",
  "INCIDENT",
  "STRATEGIC_OPERATIONAL",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

/** Where a decision came from. Every one of these is traceable to a record. */
export const TRIGGER_TYPES = [
  "OPERATIONAL_EVENT",
  "KPI_THRESHOLD",
  "GOAL_AT_RISK",
  "DEADLINE_RISK",
  "ALERT",
  "ANOMALY",
  "USER_REQUEST",
  "SCHEDULED_REVIEW",
  "AGENT_OBSERVATION",
  "RECURRING_CONDITION",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export interface DecisionEvidence {
  id: string;
  kind: EvidenceKind;
  statement: string;
  sourceSystem: string;
  sourceEntity: string | null;
  /** Required for FACT, CALCULATION and OBSERVATION; the database enforces it. */
  sourceRecord: string | null;
  measuredAt: string | null;
  calculation: string | null;
  freshness: string | null;
  confidence: Confidence;
}

export interface DecisionOption {
  id: string;
  label: string;
  title: string;
  description: string;
  expectedBenefit: string | null;
  expectedCost: string | null;
  /** Null where no figure could be estimated. Never a placeholder number. */
  financialImpact: number | null;
  financialBasis: string | null;
  customerImpact: Severity | null;
  operationalImpact: Severity | null;
  reputationImpact: Severity | null;
  securityImpact: Severity | null;
  complianceImpact: Severity | null;
  resourceImpact: string | null;
  timeToEffect: string | null;
  reversibility: "REVERSIBLE" | "PARTIAL" | "IRREVERSIBLE" | "UNKNOWN" | null;
  riskSummary: string | null;
  dependencies: string[];
  constraints: string[];
  confidenceScore: number | null;
  isRecommended: boolean;
}

/**
 * Confidence, with the reasoning that produced it.
 *
 * The score is a function of the factors, not a judgement typed beside them.
 * Storing both is what makes it possible to ask later why a decision was 40
 * per cent confident rather than 80.
 */
/**
 * The inputs a confidence score was derived from.
 *
 * A concrete shape rather than a bag of unknowns: it crosses the server
 * boundary, and more importantly a reader asking "why is this 40 per cent"
 * needs named fields rather than whatever happened to be stored.
 */
export interface ConfidenceFactors {
  /** Share of the evidence that is FACT, OBSERVATION or CALCULATION. */
  completeness: number;
  /** Share of sourced evidence that is still fresh. */
  freshness: number;
  /** How many distinct source systems agree. */
  sourceCount: number;
  /** Set when two sources disagree about the same subject. */
  conflicts: number;
  /** Evidence that is assumption or inference rather than measurement. */
  assumptions: number;
  notes: string[];
}

export interface ConfidenceAssessment {
  score: number;
  level: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
  factors: ConfidenceFactors;
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  decisionType: string;
  domain: string;
  state: DecisionState;
  priority: number;
  triggerType: string;
  triggerReference: string | null;
  confidenceScore: number | null;
  confidenceLevel: string | null;
  confidenceFactors: Partial<ConfidenceFactors>;
  evidenceGap: EvidenceGap;
  riskLevel: Severity;
  impactLevel: Severity;
  approvalRequired: boolean;
  recommendedOptionId: string | null;
  selectedOptionId: string | null;
  overrideReason: string | null;
  policyId: string | null;
  policyVersion: number | null;
  decisionDueAt: string | null;
  approvalDueAt: string | null;
  outcome: string | null;
  outcomeRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
  actorKind: "HUMAN" | "AI" | "SYSTEM" | "EXTERNAL";
}

export interface ApprovalRecord {
  id: string;
  decisionId: string;
  approvalType: string;
  requestedBy: string | null;
  requesterKind: string;
  awaitingRole: string | null;
  approverId: string | null;
  riskLevel: Severity;
  impactLevel: Severity;
  reason: string;
  state: ApprovalState;
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  expiresAt: string;
  /** Worked out at read time, because a stored flag would go out of date. */
  isExpired: boolean;
}

/**
 * What a policy decided, and why.
 *
 * The reason is part of the result rather than a log line: an approval that
 * cannot say which rule required it is not governance, it is a form.
 */
export interface PolicyDecision {
  policyId: string | null;
  policyKey: string | null;
  policyVersion: number | null;
  actionClass: ActionClass;
  allowed: boolean;
  blocked: boolean;
  requiresApproval: boolean;
  requiresSecondReviewer: boolean;
  forbidSelfApproval: boolean;
  escalate: boolean;
  approverRoles: string[];
  approvalTtlHours: number;
  /** Plain sentences naming the rules that applied. */
  reasons: string[];
}

/** Everything a reader needs to understand a recommendation. Section 32. */
export interface DecisionExplanation {
  whyFlagged: string;
  whatDataWasUsed: string[];
  whatChanged: string | null;
  optionsConsidered: Array<{ label: string; title: string; whyNot: string | null }>;
  whyThisOption: string | null;
  risks: string[];
  whatIsUnknown: string[];
  approvalRequired: string;
}

export interface DecisionDetail {
  decision: DecisionRecord;
  options: DecisionOption[];
  evidence: DecisionEvidence[];
  approval: ApprovalRecord | null;
  policy: PolicyDecision | null;
  explanation: DecisionExplanation;
  history: Array<{
    at: string;
    actorKind: string;
    entryType: string;
    fromState: string | null;
    toState: string | null;
    reason: string | null;
  }>;
  conflicts: Array<{ id: string; subject: string; conflictType: string; status: string }>;
}

/** A row on the Approval Suggestions surface. Section 28. */
export interface ApprovalSuggestion {
  decisionId: string;
  approvalId: string | null;
  title: string;
  whatHappened: string;
  whyItMatters: string;
  evidenceCount: number;
  sourcedEvidenceCount: number;
  risk: Severity;
  impact: Severity;
  recommendation: string | null;
  approvalRequired: boolean;
  awaitingRole: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  state: DecisionState;
  approvalState: ApprovalState | null;
  evidenceGap: EvidenceGap;
  confidenceScore: number | null;
  createdAt: string;
}

export type { Domain, Severity };
