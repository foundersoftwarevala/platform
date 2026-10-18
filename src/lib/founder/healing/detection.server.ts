import type { Severity } from "../state.types";

/**
 * Turning a signal into an incident, when it is genuinely one.
 *
 * This extends the monitoring pipeline rather than duplicating it. A
 * Monitoring Agent already raises a signal, which is correlated and routed;
 * what this adds is the last question — is this an operational failure the
 * system could act on, and if so, of what kind.
 *
 * Two things it is careful about.
 *
 * Not every signal is an incident. A KPI drifting is not a failure; a
 * provider refusing sixty requests is. Creating an incident for everything
 * would fill the queue with things no recovery could touch, and the worker
 * would spend its budget on them.
 *
 * Sixty agents reporting one outage must produce one incident. The
 * correlation key is what makes that true, and the unique index on open
 * incidents is what enforces it — a repeat is absorbed by the incident
 * already open rather than creating a rival.
 */

export type FailureClass =
  | "TRANSIENT"
  | "CONFIGURATION"
  | "DATA"
  | "WORKFLOW"
  | "DEPENDENCY"
  | "PERFORMANCE"
  | "SECURITY"
  | "UNKNOWN";

export interface FailureSignal {
  /** The agent or system that noticed. */
  sourceSystem: string;
  kind: string;
  domain: string;
  title: string;
  detail: string;
  severity: Severity;
  entityType?: string | null;
  entityId?: string | null;
  eventId?: string | null;
  agentRunId?: string | null;
  /** What the reporter actually observed. */
  evidence?: Record<string, unknown>;
}

export interface Classification {
  failureClass: FailureClass;
  /** Why it was classified this way, for the audit and the dashboard. */
  because: string;
  /** False where this is not an operational failure at all. */
  isFailure: boolean;
}

/**
 * What kind of failure this is.
 *
 * Deliberately conservative: anything that does not match a known shape is
 * UNKNOWN, which is not autonomously recoverable. Guessing a class would mean
 * guessing a recovery, and a wrong guess about a DATA failure is how
 * authoritative records get rewritten to make an error disappear.
 */
export function classify(signal: FailureSignal): Classification {
  const text = `${signal.kind} ${signal.title} ${signal.detail}`.toLowerCase();

  // Security first: anything that looks like it must never fall through into
  // a class that heals itself.
  if (/unauthor|forbidden|permission denied|injection|escalat\w* privilege|credential/.test(text)) {
    return {
      failureClass: "SECURITY",
      because: "the signal describes an access or credential anomaly",
      isFailure: true,
    };
  }

  if (/timeout|timed out|502|503|504|econnreset|temporarily unavailable|rate.?limit/.test(text)) {
    return {
      failureClass: "TRANSIENT",
      because: "the signal describes a timeout or a temporary refusal",
      isFailure: true,
    };
  }

  if (/provider|upstream|integration|third.?party|gateway|api .*(fail|error)/.test(text)) {
    return {
      failureClass: "DEPENDENCY",
      because: "the signal names a system this platform depends on",
      isFailure: true,
    };
  }

  if (/stuck|stalled|not advancing|blocked|overdue|sla breach|no verification/.test(text)) {
    return {
      failureClass: "WORKFLOW",
      because: "the signal describes work that is not progressing",
      isFailure: true,
    };
  }

  if (/latency|slow|backlog|queue depth|overload|degrad/.test(text)) {
    return {
      failureClass: "PERFORMANCE",
      because: "the signal describes degradation rather than failure",
      isFailure: true,
    };
  }

  if (/inconsistent|orphan|duplicate record|missing derived|integrity/.test(text)) {
    return {
      failureClass: "DATA",
      because: "the signal describes a consistency problem in stored data",
      isFailure: true,
    };
  }

  if (/misconfigur|config|setting .*(wrong|missing)|not configured/.test(text)) {
    return {
      failureClass: "CONFIGURATION",
      because: "the signal points at configuration rather than behaviour",
      isFailure: true,
    };
  }

  // A signal that is simply news — a KPI moved, a report is ready — is not a
  // failure, and an incident would be a queue entry nothing can act on.
  if (/^(kpi|goal|milestone|report|summary|reading)/.test(signal.kind.toLowerCase())) {
    return {
      failureClass: "UNKNOWN",
      because: "the signal reports a change rather than a failure",
      isFailure: false,
    };
  }

  return {
    failureClass: "UNKNOWN",
    because: "the signal does not match a known failure shape, so no recovery can be chosen for it",
    isFailure: signal.severity === "CRITICAL" || signal.severity === "HIGH",
  };
}

/**
 * What makes two reports the same failure.
 *
 * Domain, kind and entity. Deliberately not the time or the wording: sixty
 * agents describing one outage will word it sixty ways, and if the key
 * included that, sixty incidents would open.
 */
export function correlationKey(signal: FailureSignal, cls: FailureClass): string {
  return [cls, signal.domain, signal.kind, signal.entityType ?? "-", signal.entityId ?? "-"]
    .join("|")
    .toLowerCase();
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rows(path: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status}`);
  return (await response.json()) as Row[];
}

export type DetectionOutcome =
  | { created: true; incidentId: string; failureClass: FailureClass; eligible: boolean }
  | { created: false; reason: string; correlatedWith?: string };

/**
 * Raise an incident for a signal, if it is one.
 *
 * A signal that is not a failure is refused here rather than filtered later.
 * A repeat of something already open is absorbed. Everything else becomes an
 * incident, and only the classes whose policy permits it are made ELIGIBLE —
 * which is what decides whether the worker will ever touch it.
 */
export async function detectIncident(signal: FailureSignal): Promise<DetectionOutcome> {
  const cls = classify(signal);
  if (!cls.isFailure) {
    return { created: false, reason: cls.because };
  }

  const key = correlationKey(signal, cls.failureClass);

  // Already open? Then this is the same outage reported again.
  const open = await rows(
    `founder_incidents?select=id&correlation_key=eq.${encodeURIComponent(key)}` +
      `&state=not.in.(RESOLVED,CONTAINED,ESCALATED,FAILED)&limit=1`,
  ).catch(() => [] as Row[]);
  if (open[0]) {
    return {
      created: false,
      reason: "an incident for this failure is already open",
      correlatedWith: String(open[0].id),
    };
  }

  const policy = await rows(
    `founder_recovery_policies?select=autonomous,verification_method&failure_class=eq.${cls.failureClass}&limit=1`,
  ).catch(() => [] as Row[]);
  const autonomous = policy[0]?.autonomous === true;

  const base = restUrl();
  const response = await fetch(`${base}/rest/v1/founder_incidents`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      title: signal.title.slice(0, 300),
      detail: signal.detail.slice(0, 4000),
      failure_class: cls.failureClass,
      severity: signal.severity,
      domain: signal.domain,
      source_system: signal.sourceSystem,
      entity_type: signal.entityType ?? null,
      entity_id: signal.entityId ?? null,
      event_id: signal.eventId ?? null,
      agent_run_id: signal.agentRunId ?? null,
      correlation_key: key,
      root_cause_hypothesis: cls.because,
      diagnosis_evidence: signal.evidence ?? { raisedBy: signal.sourceSystem, kind: signal.kind },
      // Copied in now so a later policy edit cannot lower the bar a past
      // incident was held to.
      verification_requirement: policy[0]?.verification_method
        ? String(policy[0].verification_method)
        : null,
      // Only a class its policy allows becomes eligible. Everything else sits
      // in DETECTED for a person, which is what keeps CONFIGURATION, DATA,
      // SECURITY and UNKNOWN off the autonomous path entirely.
      state: autonomous ? "ELIGIBLE" : "DETECTED",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // A unique violation here means another worker raised it first, which is
    // the correlation index doing its job rather than an error.
    if (/duplicate key/i.test(text)) {
      return { created: false, reason: "another reporter raised this incident first" };
    }
    return { created: false, reason: `the incident could not be raised: ${text.slice(0, 200)}` };
  }

  const created = ((await response.json()) as Row[])[0];
  if (!created) return { created: false, reason: "the incident could not be raised" };

  return {
    created: true,
    incidentId: String(created.id),
    failureClass: cls.failureClass,
    eligible: autonomous,
  };
}
