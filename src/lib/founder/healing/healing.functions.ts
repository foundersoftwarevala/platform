import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * What the self-healing dashboard reads.
 *
 * Every figure comes from a view that counts in SQL. Nothing is derived from
 * the rows this returns, because those are capped and a count taken from a
 * capped list stops being true the moment the table grows past it.
 *
 * The distinction this file works hardest to preserve is between "nothing
 * happened" and "we could not look". A failed read returns null, never zero,
 * so the dashboard can say DATA UNAVAILABLE rather than drawing a clean
 * board it has not established.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireExecutive(): Promise<string> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Sign-in required");

  const url = process.env["SUPABASE_URL"]?.trim();
  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? process.env["SUPABASE_ANON_KEY"]?.trim();
  if (!url || !publishable) throw new Error("Authentication is not configured");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishable, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Sign-in required");
  const user = (await response.json()) as { id?: string };
  if (!user?.id) throw new Error("Sign-in required");

  const db = await admin();
  const [{ data: isBoss }, { data: isAdmin }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.id, _role: "boss" }),
    db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
  ]);
  if (!isBoss && !isAdmin) throw new Error("Executive permission required");
  return user.id;
}

export interface HealingTotals {
  incidents: number;
  autoRecovered: number;
  inProgress: number;
  escalated: number;
  contained: number;
  failed: number;
  circuitsOpen: number;
  securityIncidents: number;
  attempts: number;
  verifiedAttempts: number;
}

export interface HealingSelfCheck {
  enabled: boolean;
  disabledReason: string | null;
  awaitingRecovery: number;
  circuitsOpen: number;
  blockedByFounder: number;
  staleLocks: number;
  /** Attempts that worked but were never confirmed. The gap that matters. */
  succeededUnverified: number;
  escalated: number;
  degraded: boolean;
}

export interface HealingBudget {
  failureClass: string;
  autonomous: boolean;
  maxAttempts: number;
  maxRecoveryMinutes: number;
  maxConcurrent: number;
  maxScopeRows: number;
  currentlyRecovering: number;
  awaiting: number;
}

export interface TimelineRow {
  incidentId: string;
  whatFailed: string;
  whyClassified: string;
  rootCauseHypothesis: string | null;
  severity: string;
  finalState: string;
  correlationKey: string | null;
  detectedAt: string;
  attemptNumber: number | null;
  actionTaken: string | null;
  whyAllowed: string | null;
  whatHappened: string | null;
  outcome: string | null;
  error: string | null;
  howVerified: string | null;
  verified: boolean;
  verificationDetail: string | null;
  attemptStartedAt: string | null;
  maxAttempts: number | null;
  autonomous: boolean | null;
}

export interface HealingBoard {
  /** Null where the read failed. Never zeros standing in for a failure. */
  totals: HealingTotals | null;
  selfCheck: HealingSelfCheck | null;
  budgets: HealingBudget[];
  timeline: TimelineRow[];
  degraded: string[];
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows(path: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status}`);
  return (await response.json()) as Row[];
}

const num = (row: Row, key: string): number => {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
};

const str = (row: Row, key: string): string | null => {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * The whole board in one request.
 *
 * Four reads, run together and each allowed to fail on its own, so one
 * unavailable view does not blank the others. What could not be read is named
 * in `degraded` rather than being drawn as empty.
 */
export const loadHealingBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<HealingBoard> => {
    await requireExecutive();
    const degraded: string[] = [];

    const [totalsRows, selfRows, budgetRows, timelineRows] = await Promise.all([
      rows("founder_healing_totals?select=*&limit=1").catch(() => {
        degraded.push("founder_healing_totals");
        return null;
      }),
      rows("founder_healing_self_check?select=*&limit=1").catch(() => {
        degraded.push("founder_healing_self_check");
        return null;
      }),
      rows("founder_recovery_budgets?select=*&order=autonomous.desc,failure_class.asc").catch(
        () => {
          degraded.push("founder_recovery_budgets");
          return [] as Row[];
        },
      ),
      // Bounded: the timeline is one row per attempt and grows without limit.
      rows(
        "founder_healing_timeline?select=*&order=detected_at.desc,attempt_number.asc&limit=200",
      ).catch(() => {
        degraded.push("founder_healing_timeline");
        return [] as Row[];
      }),
    ]);

    const t = totalsRows?.[0];
    const s = selfRows?.[0];

    return {
      totals: t
        ? {
            incidents: num(t, "incidents"),
            autoRecovered: num(t, "auto_recovered"),
            inProgress: num(t, "in_progress"),
            escalated: num(t, "escalated"),
            contained: num(t, "contained"),
            failed: num(t, "failed"),
            circuitsOpen: num(t, "circuits_open"),
            securityIncidents: num(t, "security_incidents"),
            attempts: num(t, "attempts"),
            verifiedAttempts: num(t, "verified_attempts"),
          }
        : null,
      selfCheck: s
        ? {
            enabled: s.enabled === true,
            disabledReason: str(s, "disabled_reason"),
            awaitingRecovery: num(s, "awaiting_recovery"),
            circuitsOpen: num(s, "circuits_open"),
            blockedByFounder: num(s, "blocked_by_founder"),
            staleLocks: num(s, "stale_locks"),
            succeededUnverified: num(s, "succeeded_unverified"),
            escalated: num(s, "escalated"),
            degraded: s.degraded === true,
          }
        : null,
      budgets: (budgetRows ?? []).map((row): HealingBudget => ({
        failureClass: String(row.failure_class ?? ""),
        autonomous: row.autonomous === true,
        maxAttempts: num(row, "max_attempts"),
        maxRecoveryMinutes: num(row, "max_recovery_minutes"),
        maxConcurrent: num(row, "max_concurrent"),
        maxScopeRows: num(row, "max_scope_rows"),
        currentlyRecovering: num(row, "currently_recovering"),
        awaiting: num(row, "awaiting"),
      })),
      timeline: (timelineRows ?? []).map((row): TimelineRow => ({
        incidentId: String(row.incident_id),
        whatFailed: str(row, "what_failed") ?? "",
        whyClassified: String(row.why_classified ?? ""),
        rootCauseHypothesis: str(row, "root_cause_hypothesis"),
        severity: String(row.severity ?? "MEDIUM"),
        finalState: String(row.final_state ?? "DETECTED"),
        correlationKey: str(row, "correlation_key"),
        detectedAt: str(row, "detected_at") ?? "",
        attemptNumber: row.attempt_number === null ? null : num(row, "attempt_number"),
        actionTaken: str(row, "action_taken"),
        whyAllowed: str(row, "why_allowed"),
        whatHappened: str(row, "what_happened"),
        outcome: str(row, "outcome"),
        error: str(row, "error"),
        howVerified: str(row, "how_verified"),
        verified: row.verified === true,
        verificationDetail: str(row, "verification_detail"),
        attemptStartedAt: str(row, "attempt_started_at"),
        maxAttempts: row.max_attempts === null ? null : num(row, "max_attempts"),
        autonomous: row.autonomous === null ? null : row.autonomous === true,
      })),
      degraded,
    };
  },
);
