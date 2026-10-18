import { ingestEvent, type IncomingEvent } from "../events.server";
import type { Severity } from "../state.types";

/**
 * What Founder AI does with a signal a Monitoring Agent raised.
 *
 * The path is fixed:
 *
 *   INTAKE -> CORRELATE -> PRIORITISE -> ROUTE -> RECORD
 *
 * Intake reuses ingestEvent, so a signal is an ordinary operational event
 * with the same idempotency and ordering as every other event. Nothing about
 * monitoring gets its own event store.
 *
 * Correlation is the part that makes sixty agents survivable. Sixty agents on
 * a loop will report the same outage over and over; folding a repeat into the
 * item that is already open is the difference between a queue a person can
 * work and a queue they abandon. Correlation is by what the signal is about -
 * domain, kind, entity - inside the window the route sets, and a folded
 * signal is recorded as folded rather than silently dropped.
 *
 * Prioritisation is not a judgement made here. The agent states a severity,
 * founder_signal_routes says what that severity earns, and the route in force
 * at the time is written down, so changing the ladder later cannot rewrite
 * what happened.
 *
 * Routing does only what the route permits: raise an item, notify a person,
 * escalate, open a governed decision. It never executes anything, and the
 * decision it opens is a request for approval, not an action.
 */

export type RouteLabel = string;

export interface SignalRoute {
  severity: Severity;
  label: RouteLabel;
  raisesAttention: boolean;
  attentionPriority: number;
  notifies: boolean;
  escalates: boolean;
  opensDecision: boolean;
  /** Postgres interval text, e.g. "01:00:00". */
  correlationWindow: string;
}

export interface IncomingSignal {
  /** The agent_key of the Monitoring Agent raising this. */
  agentKey: string;
  /** What kind of thing this is, e.g. "payment_failure_rate". */
  kind: string;
  domain: string;
  title: string;
  reason: string;
  severity: Severity;
  sourceSystem: string;
  /** The producer's own id. Two signals with the same id are one signal. */
  sourceRef: string;
  occurredAt?: string;
  entityType?: string | null;
  entityId?: string | null;
  /** What the agent actually read. A signal with no evidence is an opinion. */
  evidence?: Record<string, unknown>;
  correlationId?: string | null;
}

export type SignalOutcome =
  | {
      accepted: true;
      eventId: string;
      route: RouteLabel;
      attentionId: string | null;
      decisionId: string | null;
      notified: boolean;
      escalated: boolean;
      /** True where this folded into an item that was already open. */
      correlated: boolean;
      duplicate: boolean;
    }
  | { accepted: false; reason: string };

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

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status}`);
  return (await response.json()) as Row[];
}

async function insert(table: string, body: unknown): Promise<Row | null> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as Row[];
  return data[0] ?? null;
}

/** The ladder as it currently stands. Read, never assumed. */
export async function loadRoutes(): Promise<Map<Severity, SignalRoute>> {
  const data = await rows("founder_signal_routes", "select=*");
  const map = new Map<Severity, SignalRoute>();
  for (const row of data) {
    const severity = String(row.severity) as Severity;
    map.set(severity, {
      severity,
      label: String(row.label ?? ""),
      raisesAttention: row.raises_attention === true,
      attentionPriority: Number(row.attention_priority ?? 3),
      notifies: row.notifies === true,
      escalates: row.escalates === true,
      opensDecision: row.opens_decision === true,
      correlationWindow: String(row.correlation_window ?? "01:00:00"),
    });
  }
  return map;
}

/** Postgres interval text to milliseconds, for the correlation cut-off. */
function windowMs(interval: string): number {
  const hms = /^(\d+):(\d{2}):(\d{2})/.exec(interval);
  if (hms) {
    return (Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])) * 1000;
  }
  // Postgres also renders longer spans in words, e.g. "06:00:00" or "1 day".
  const days = /(\d+)\s*day/.exec(interval);
  const hours = /(\d+)\s*hour/.exec(interval);
  const mins = /(\d+)\s*min/.exec(interval);
  const total =
    (days ? Number(days[1]) * 86_400 : 0) +
    (hours ? Number(hours[1]) * 3600 : 0) +
    (mins ? Number(mins[1]) * 60 : 0);
  return total > 0 ? total * 1000 : 3_600_000;
}

/**
 * The open item this signal belongs to, if there is one.
 *
 * Same domain, same kind, same entity, still open, raised inside the window.
 * Anything else is a different problem and gets its own item.
 */
async function findOpenItem(signal: IncomingSignal, route: SignalRoute): Promise<string | null> {
  const since = new Date(Date.now() - windowMs(route.correlationWindow)).toISOString();
  const parts = [
    "select=id",
    `domain=eq.${encodeURIComponent(signal.domain)}`,
    `kind=eq.${encodeURIComponent(signal.kind)}`,
    "status=in.(NEW,ACKNOWLEDGED,IN_PROGRESS)",
    `created_at=gte.${encodeURIComponent(since)}`,
    "order=created_at.desc",
    "limit=1",
  ];
  parts.push(
    signal.entityId ? `entity_id=eq.${encodeURIComponent(signal.entityId)}` : "entity_id=is.null",
  );

  try {
    const found = await rows("founder_attention", parts.join("&"));
    return found[0] ? String(found[0].id) : null;
  } catch (error) {
    // A correlation lookup that fails must not silently create a duplicate
    // without saying so; it is reported as uncorrelated, which is the truth.
    console.error("[founder/monitoring] correlation lookup failed:", error);
    return null;
  }
}

/** The agent raising this, and whether it is allowed to. */
async function resolveAgent(
  agentKey: string,
): Promise<{ id: string; permissions: string[] } | null> {
  const found = await rows(
    "ai_agents",
    `select=id,permissions&agent_key=eq.${encodeURIComponent(agentKey)}&limit=1`,
  );
  const row = found[0];
  if (!row) return null;
  return {
    id: String(row.id),
    permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
  };
}

/**
 * Take one signal all the way through.
 *
 * Every failure returns a reason rather than throwing, because a monitoring
 * loop that dies on one bad signal stops watching everything else.
 */
export async function routeSignal(signal: IncomingSignal): Promise<SignalOutcome> {
  let agent: { id: string; permissions: string[] } | null;
  try {
    agent = await resolveAgent(signal.agentKey);
  } catch (error) {
    return { accepted: false, reason: `the agent register could not be read: ${String(error)}` };
  }
  if (!agent) return { accepted: false, reason: `no agent is registered as ${signal.agentKey}` };

  // Raising a signal means creating an item, so the agent needs CREATE. An
  // agent that may only read cannot put work into the queue.
  if (!agent.permissions.includes("CREATE")) {
    return { accepted: false, reason: `${signal.agentKey} does not hold CREATE` };
  }

  let routes: Map<Severity, SignalRoute>;
  try {
    routes = await loadRoutes();
  } catch (error) {
    return { accepted: false, reason: `the signal routes could not be read: ${String(error)}` };
  }
  const route = routes.get(signal.severity);
  if (!route) return { accepted: false, reason: `no route is configured for ${signal.severity}` };

  // INTAKE. The signal becomes an ordinary event, idempotent on sourceRef.
  const event: IncomingEvent = {
    eventType: `monitor.${signal.kind}`,
    domain: signal.domain,
    sourceSystem: signal.sourceSystem,
    sourceEventId: signal.sourceRef,
    occurredAt: signal.occurredAt ?? new Date().toISOString(),
    entityType: signal.entityType ?? null,
    entityId: signal.entityId ?? null,
    severity: signal.severity,
    actorType: "AI",
    actorId: agent.id,
    correlationId: signal.correlationId ?? null,
    payload: { title: signal.title, reason: signal.reason, ...(signal.evidence ?? {}) },
    metadata: { agentKey: signal.agentKey, route: route.label },
  };

  const ingested = await ingestEvent(event);
  if (!ingested.accepted) return { accepted: false, reason: ingested.reason };

  // The same signal arriving twice is one signal. It is not re-routed, and it
  // does not raise a second item.
  if (ingested.duplicate) {
    const existing = await rows(
      "founder_signal_dispatch",
      `select=*&event_id=eq.${encodeURIComponent(ingested.id)}&limit=1`,
    ).catch(() => [] as Row[]);
    const prior = existing[0];
    return {
      accepted: true,
      eventId: ingested.id,
      route: prior ? String(prior.route_label) : route.label,
      attentionId: prior?.attention_id ? String(prior.attention_id) : null,
      decisionId: prior?.decision_id ? String(prior.decision_id) : null,
      notified: prior?.notified === true,
      escalated: prior?.escalated === true,
      correlated: prior?.correlated === true,
      duplicate: true,
    };
  }

  // INFO is watched and nothing more. The event is the record.
  if (!route.raisesAttention) {
    await insert("founder_signal_dispatch", {
      event_id: ingested.id,
      agent_id: agent.id,
      severity: signal.severity,
      route_label: route.label,
      correlated: false,
    }).catch((error) => {
      console.error("[founder/monitoring] dispatch not recorded:", error);
      return null;
    });
    return {
      accepted: true,
      eventId: ingested.id,
      route: route.label,
      attentionId: null,
      decisionId: null,
      notified: false,
      escalated: false,
      correlated: false,
      duplicate: false,
    };
  }

  // CORRELATE, then raise or fold.
  const openItem = await findOpenItem(signal, route);
  let attentionId = openItem;
  const correlated = openItem !== null;

  /**
   * An attention item has to carry evidence — the table refuses an empty
   * object, and rightly: an item nobody can trace is an assertion. Where the
   * agent supplied readings they are the evidence; where it did not, the
   * signal's own provenance is, which is the least that can honestly be said
   * about where this came from.
   */
  const evidence =
    signal.evidence && Object.keys(signal.evidence).length > 0
      ? signal.evidence
      : {
          raisedBy: signal.agentKey,
          sourceSystem: signal.sourceSystem,
          sourceRef: signal.sourceRef,
          severity: signal.severity,
          observedAt: signal.occurredAt ?? new Date().toISOString(),
          note: "The agent supplied no readings; this records only where the signal came from.",
        };

  if (!correlated) {
    try {
      const item = await insert("founder_attention", {
        kind: signal.kind,
        domain: signal.domain,
        title: signal.title,
        reason: signal.reason,
        severity: signal.severity,
        priority: route.attentionPriority,
        source_system: signal.sourceSystem,
        source_ref: signal.sourceRef,
        entity_type: signal.entityType ?? null,
        entity_id: signal.entityId ?? null,
        evidence,
        status: "NEW",
      });
      attentionId = item ? String(item.id) : null;
    } catch (error) {
      return {
        accepted: false,
        reason: `the attention item could not be raised: ${String(error)}`,
      };
    }
  }

  // NOTIFY. Reuses the existing notifications table; no second channel is
  // built. A failure to notify is recorded as not notified, never as sent.
  let notified = false;
  if (route.notifies && attentionId) {
    notified = await notifyExecutives(signal, route, attentionId).catch((error) => {
      console.error("[founder/monitoring] notification failed:", error);
      return false;
    });
  }

  // ESCALATE and open a governed decision. The decision asks for approval; it
  // does not act, and nothing downstream may execute from it.
  let decisionId: string | null = null;
  if (route.opensDecision && attentionId) {
    decisionId = await openDecision(signal, attentionId).catch((error) => {
      console.error("[founder/monitoring] decision not opened:", error);
      return null;
    });
  }

  await insert("founder_signal_dispatch", {
    event_id: ingested.id,
    agent_id: agent.id,
    severity: signal.severity,
    route_label: route.label,
    attention_id: attentionId,
    decision_id: decisionId,
    notified,
    escalated: route.escalates && notified,
    correlated,
  }).catch((error) => {
    console.error("[founder/monitoring] dispatch not recorded:", error);
    return null;
  });

  return {
    accepted: true,
    eventId: ingested.id,
    route: route.label,
    attentionId,
    decisionId,
    notified,
    escalated: route.escalates && notified,
    correlated,
    duplicate: false,
  };
}

/** Everyone who should hear about this, through the existing table. */
async function notifyExecutives(
  signal: IncomingSignal,
  route: SignalRoute,
  attentionId: string,
): Promise<boolean> {
  const recipients = await rows(
    "user_roles",
    "select=user_id&role=in.(boss,boss_owner,admin,founder)&limit=50",
  );
  const ids = [...new Set(recipients.map((r) => String(r.user_id)).filter(Boolean))];
  if (ids.length === 0) return false;

  await insert(
    "notifications",
    ids.map((userId) => ({
      user_id: userId,
      title: `${signal.severity}: ${signal.title}`,
      body: signal.reason,
      kind: route.escalates ? "escalation" : "alert",
      data: {
        attentionId,
        domain: signal.domain,
        agentKey: signal.agentKey,
        severity: signal.severity,
        sourceSystem: signal.sourceSystem,
      },
    })),
  );
  return true;
}

/**
 * A critical signal opens a decision rather than an action.
 *
 * It is created in DETECTED with the evidence that prompted it. Everything
 * after that - options, recommendation, approval - belongs to the Decision
 * Engine, which is what keeps a monitoring agent from acting on its own
 * alarm.
 */
async function openDecision(signal: IncomingSignal, attentionId: string): Promise<string | null> {
  const created = await insert("founder_decisions", {
    title: signal.title,
    description: signal.reason,
    decision_type: "OPERATIONAL_RESPONSE",
    domain: signal.domain,
    state: "DETECTED",
    priority: 1,
    trigger_type: "MONITORING_SIGNAL",
    trigger_reference: signal.sourceRef,
    risk_level: signal.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
    impact_level: signal.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
    approval_required: true,
    actor_kind: "AI",
    context_ref: { attentionId, agentKey: signal.agentKey, sourceSystem: signal.sourceSystem },
    idempotency_key: `monitor:${signal.sourceRef}`,
  });
  return created ? String(created.id) : null;
}
