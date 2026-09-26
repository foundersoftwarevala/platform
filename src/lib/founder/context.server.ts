import { loadOperatingState } from "./operating-state.server";
import type { AttentionItem, Deadline, Kpi, OperatingState } from "./state.types";

/**
 * The snapshot, and the filtered context read off it.
 *
 * A snapshot is a cache and never the authority. It records the watermark it
 * was built at, so a consumer can ask whether anything has happened since —
 * and if something has, it says so rather than answering confidently from a
 * picture of yesterday. Section 29 of the brief is the whole reason this exists:
 * an AI reasoning from a stale snapshot is worse than one that knows it is
 * blind.
 *
 * The filtered context matters for a different reason. Handing a model the
 * entire company state on every question wastes its attention on records that
 * have nothing to do with what was asked, and a model that has been given
 * everything tends to answer from the wrong part of it. `contextFor` selects.
 */

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

export type Consistency = "FRESH" | "STALE" | "REBUILDING" | "INCONSISTENT";

export interface SnapshotRecord {
  id: string;
  builtAt: string;
  builtBy: string;
  eventWatermark: string | null;
  consistency: Consistency;
  degraded: string[];
  state: OperatingState;
}

/** Build the state and store it, with the watermark that dates it. */
export async function buildSnapshot(builtBy: string): Promise<SnapshotRecord> {
  const state = await loadOperatingState();
  const watermark = state.recentEvents[0]?.occurredAt ?? null;

  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");

  const response = await fetch(`${base}/rest/v1/founder_state_snapshots`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      built_by: builtBy,
      event_watermark: watermark,
      state,
      consistency: state.degraded.length > 0 ? "INCONSISTENT" : "FRESH",
      degraded: state.degraded,
      source_versions: Object.fromEntries(
        Object.entries(state.sources).map(([k, v]) => [k, v.measuredAt ?? null]),
      ),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `snapshot not stored: ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }

  const created = (await response.json()) as Record<string, unknown>[];
  const row = created[0] ?? {};
  return {
    id: String(row.id ?? ""),
    builtAt: String(row.built_at ?? new Date().toISOString()),
    builtBy,
    eventWatermark: watermark,
    consistency: state.degraded.length > 0 ? "INCONSISTENT" : "FRESH",
    degraded: state.degraded,
    state,
  };
}

/**
 * The newest snapshot, re-judged against what has happened since.
 *
 * A snapshot stored as FRESH does not stay fresh. If an event has arrived with
 * a later occurred_at than the watermark, the snapshot is reported STALE even
 * though nothing about the stored row changed — which is the only way a cache
 * can be honest about itself.
 */
export async function latestSnapshot(): Promise<SnapshotRecord | null> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");

  const response = await fetch(
    `${base}/rest/v1/founder_state_snapshots?select=*&order=built_at.desc&limit=1`,
    { headers: restHeaders() },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;

  const watermark = typeof row.event_watermark === "string" ? row.event_watermark : null;
  let consistency = (row.consistency as Consistency) ?? "FRESH";

  const newer = await fetch(
    `${base}/rest/v1/founder_events?select=occurred_at&order=occurred_at.desc&limit=1`,
    { headers: restHeaders() },
  );
  if (newer.ok) {
    const latest = (await newer.json()) as { occurred_at?: string }[];
    const at = latest[0]?.occurred_at ?? null;
    if (at && (!watermark || at > watermark)) consistency = "STALE";
  }

  return {
    id: String(row.id ?? ""),
    builtAt: String(row.built_at ?? ""),
    builtBy: String(row.built_by ?? ""),
    eventWatermark: watermark,
    consistency,
    degraded: Array.isArray(row.degraded) ? row.degraded.map(String) : [],
    state: row.state as OperatingState,
  };
}

/**
 * Rebuild from the authoritative tables.
 *
 * Idempotent by construction: it reads the sources again and writes a new
 * snapshot, so running it twice produces the same picture rather than
 * compounding anything. Old snapshots are kept — they are the record of what
 * the company looked like at the time, and deleting them would throw away the
 * only way to audit a past decision.
 */
export async function rebuildState(reason: string): Promise<SnapshotRecord> {
  return buildSnapshot(`rebuild: ${reason}`);
}

export type ContextIntent =
  "URGENT" | "GOALS" | "PERFORMANCE" | "RISK" | "WORKLOAD" | "DEADLINES" | "FULL";

/**
 * The named collections a context can carry, each optional.
 *
 * Deliberately a concrete shape rather than a bag of unknowns: a caller that
 * asks for the urgent context should get typed deadlines and KPIs, not
 * something it has to cast, and the server-function boundary will not carry an
 * `unknown` across the wire anyway.
 */
export interface ContextSlice {
  goals?: OperatingState["goals"];
  kpis?: OperatingState["kpis"];
  initiatives?: OperatingState["initiatives"];
  risks?: OperatingState["risks"];
  attention?: OperatingState["attention"];
  deadlines?: OperatingState["deadlines"];
  workload?: OperatingState["workload"];
  health?: OperatingState["health"];
  recentEvents?: OperatingState["recentEvents"];
  pendingApprovals?: OperatingState["pendingApprovals"];
}

export interface FilteredContext {
  intent: ContextIntent;
  builtAt: string;
  organization: OperatingState["organization"];
  /** Only what the question needs. */
  included: ContextSlice;
  /** What was deliberately left out, so the reader knows it was a choice. */
  omitted: string[];
  sources: OperatingState["sources"];
  degraded: string[];
  /** How current the included parts are. */
  freshness: Record<string, string>;
}

const URGENT_STATES = new Set(["OVERDUE", "AT_RISK", "DUE_SOON"]);

function urgentDeadlines(deadlines: Deadline[]): Deadline[] {
  return deadlines.filter((d) => URGENT_STATES.has(d.state));
}

function failingKpis(kpis: Kpi[]): Kpi[] {
  return kpis.filter((k) => k.status === "AT_RISK" || k.status === "CRITICAL");
}

function pressingAttention(attention: AttentionItem[]): AttentionItem[] {
  return attention.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH");
}

/**
 * The slice of the state a question actually needs.
 *
 * "What is most urgent today?" wants critical alerts, overdue work, failing
 * KPIs and blocked initiatives — not the goal list and not last quarter's
 * events. Everything left out is named in `omitted`, so a reader is never left
 * wondering whether something was missing or simply absent.
 */
export async function contextFor(
  intent: ContextIntent,
  state?: OperatingState,
): Promise<FilteredContext> {
  const current = state ?? (await loadOperatingState());
  const all = [
    "goals",
    "kpis",
    "initiatives",
    "risks",
    "attention",
    "deadlines",
    "workload",
    "health",
    "recentEvents",
    "pendingApprovals",
  ];

  let included: ContextSlice;
  switch (intent) {
    case "URGENT":
      included = {
        attention: pressingAttention(current.attention),
        deadlines: urgentDeadlines(current.deadlines),
        kpis: failingKpis(current.kpis),
        risks: current.risks.filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH"),
        pendingApprovals: current.pendingApprovals,
        health: current.health.filter((h) => h.health === "CRITICAL" || h.health === "AT_RISK"),
      };
      break;
    case "GOALS":
      included = { goals: current.goals, initiatives: current.initiatives, kpis: current.kpis };
      break;
    case "PERFORMANCE":
      included = { kpis: current.kpis, health: current.health, goals: current.goals };
      break;
    case "RISK":
      included = {
        risks: current.risks,
        attention: current.attention,
        health: current.health,
        deadlines: urgentDeadlines(current.deadlines),
      };
      break;
    case "WORKLOAD":
      included = { workload: current.workload, deadlines: current.deadlines };
      break;
    case "DEADLINES":
      included = { deadlines: current.deadlines, initiatives: current.initiatives };
      break;
    default:
      included = {
        goals: current.goals,
        kpis: current.kpis,
        initiatives: current.initiatives,
        risks: current.risks,
        attention: current.attention,
        deadlines: current.deadlines,
        workload: current.workload,
        health: current.health,
        recentEvents: current.recentEvents,
        pendingApprovals: current.pendingApprovals,
      };
  }

  const keys = Object.keys(included);
  return {
    intent,
    builtAt: current.builtAt,
    organization: current.organization,
    included,
    omitted: all.filter((k) => !keys.includes(k)),
    sources: current.sources,
    degraded: current.degraded,
    freshness: Object.fromEntries(
      Object.entries(current.sources).map(([k, v]) => [k, v.freshness]),
    ),
  };
}
