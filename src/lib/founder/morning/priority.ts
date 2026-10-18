import type { AttentionItem, Deadline, Kpi, Risk, Severity } from "../state.types";

/**
 * Deciding what the company should work on today, and being able to say why.
 *
 * This is deliberately arithmetic rather than a model call. A priority that
 * came out of a language model cannot be argued with, cannot be reproduced
 * tomorrow, and cannot be corrected by changing a number - and the one thing
 * an operator must be able to do with the day's order is disagree with it.
 *
 * Every contribution to a score carries the sentence that explains it, so the
 * reason shown on the screen is assembled from the same arithmetic that
 * produced the number. There is no separate explanation that could drift.
 *
 * Nothing here overrides a human. Where a person has set a priority on the
 * underlying work, that priority is the dominant term and this can only order
 * within it.
 */

export type PlanSource = "ATTENTION" | "TASK" | "DECISION";

export interface Candidate {
  source: PlanSource;
  /** The id of the thing this points at; the plan never holds work itself. */
  sourceId: string;
  title: string;
  domain: string;
  severity: Severity;
  /** A priority a person set, 1 (highest) to 5. Null where nobody has. */
  humanPriority: number | null;
  /** When this is due, where it has a deadline. */
  dueAt: string | null;
  /** True where the work is blocked on something else. */
  blocked: boolean;
  /** True where it cannot proceed without an approval that has not come. */
  awaitingApproval: boolean;
  /** Which capability or specialization the work needs, where known. */
  needs: string | null;
}

export interface Scored extends Candidate {
  score: number;
  reason: string;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 50,
  HIGH: 30,
  MEDIUM: 15,
  LOW: 5,
  INFO: 0,
};

const SEVERITY_WORD: Record<Severity, string> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "informational",
};

/** Hours until something is due. Negative means it is already late. */
function hoursUntil(dueAt: string | null): number | null {
  if (!dueAt) return null;
  const at = new Date(dueAt).getTime();
  if (!Number.isFinite(at)) return null;
  return (at - Date.now()) / 3_600_000;
}

/**
 * One candidate's score, and the sentence that justifies it.
 *
 * A human-set priority dominates everything else, because the rule is that
 * this never silently reorders around a person's decision.
 */
export function score(candidate: Candidate): Scored {
  const parts: string[] = [];
  let total = 0;

  if (candidate.humanPriority !== null) {
    // 1 is the most urgent. A human priority is worth more than any signal
    // this can compute, so it sets the band and the rest orders within it.
    const weight = (6 - Math.min(5, Math.max(1, candidate.humanPriority))) * 100;
    total += weight;
    parts.push(`a person set priority ${candidate.humanPriority}`);
  }

  const severityWeight = SEVERITY_WEIGHT[candidate.severity] ?? 0;
  if (severityWeight > 0) {
    total += severityWeight;
    parts.push(`${SEVERITY_WORD[candidate.severity]} severity`);
  }

  const hours = hoursUntil(candidate.dueAt);
  if (hours !== null) {
    if (hours < 0) {
      total += 40;
      parts.push(`overdue by ${Math.round(-hours)}h`);
    } else if (hours <= 24) {
      total += 25;
      parts.push(`due within ${Math.max(1, Math.round(hours))}h`);
    } else if (hours <= 72) {
      total += 10;
      parts.push(`due in ${Math.round(hours / 24)}d`);
    }
  }

  if (candidate.awaitingApproval) {
    // Something waiting on a person is not work the company can do; it is
    // work a person is holding, and that is worth surfacing early.
    total += 20;
    parts.push("waiting on an approval");
  }

  if (candidate.blocked) {
    // A blocked item is not worked today, but it is not hidden either: it is
    // pushed down rather than dropped, so the blockage stays visible.
    total -= 15;
    parts.push("blocked on something else");
  }

  if (parts.length === 0) {
    parts.push("no urgency signal, ordered after everything that has one");
  }

  return {
    ...candidate,
    score: total,
    reason: parts.join("; "),
  };
}

/** The day's order: highest score first, and stable where scores tie. */
export function prioritise(candidates: Candidate[]): Scored[] {
  return candidates
    .map(score)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.score - a.item.score || a.index - b.index)
    .map(({ item }) => item);
}

/** Attention items as candidates. */
export function fromAttention(items: AttentionItem[]): Candidate[] {
  return items
    .filter((item) => item.status !== "RESOLVED" && item.status !== "DISMISSED")
    .map((item) => ({
      source: "ATTENTION" as const,
      sourceId: item.id,
      title: item.title,
      domain: item.domain,
      severity: item.severity,
      humanPriority: item.priority,
      dueAt: null,
      blocked: false,
      awaitingApproval: false,
      needs: item.kind,
    }));
}

/**
 * Deadlines that are close or already missed.
 *
 * A deadline carries its own judgement in `state` — the operating state has
 * already worked out whether it is overdue, at risk or merely scheduled, and
 * re-deriving that here would be a second opinion that could disagree with
 * the one every other screen shows.
 */
export function fromDeadlines(deadlines: Deadline[]): Candidate[] {
  return deadlines
    .filter((deadline) => deadline.state !== "DONE")
    .map((deadline) => ({
      source: "TASK" as const,
      sourceId: deadline.id,
      title: deadline.title,
      // A deadline has no domain of its own; it belongs to whatever it is on.
      domain: deadline.kind,
      severity:
        deadline.state === "OVERDUE"
          ? "CRITICAL"
          : deadline.state === "AT_RISK" || deadline.state === "DUE_SOON"
            ? "HIGH"
            : "MEDIUM",
      humanPriority: null,
      dueAt: deadline.dueOn,
      blocked: deadline.blockedBy.length > 0,
      awaitingApproval: false,
      needs: deadline.kind,
    }));
}

/** A KPI that has breached its own threshold is work, not decoration. */
export function fromKpis(kpis: Kpi[]): Candidate[] {
  return kpis
    .filter((kpi) => kpi.status === "AT_RISK" || kpi.status === "CRITICAL")
    .map((kpi) => ({
      source: "ATTENTION" as const,
      sourceId: kpi.id,
      title: `${kpi.name}: ${kpi.statusReason}`,
      domain: kpi.domain,
      severity: kpi.status === "CRITICAL" ? "CRITICAL" : "HIGH",
      humanPriority: null,
      dueAt: null,
      blocked: false,
      awaitingApproval: false,
      needs: "kpi",
    }));
}

/** Open risks. */
export function fromRisks(risks: Risk[]): Candidate[] {
  return risks
    .filter((risk) => risk.status !== "CLOSED" && risk.status !== "MITIGATED")
    .map((risk) => ({
      source: "ATTENTION" as const,
      sourceId: risk.id,
      title: risk.title,
      domain: risk.domain,
      severity: risk.severity,
      humanPriority: null,
      dueAt: null,
      blocked: false,
      awaitingApproval: false,
      needs: "risk",
    }));
}
