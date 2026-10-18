/**
 * Choosing which registered AI service answers a request.
 *
 * Nothing in the calling code names a model. A caller says what it needs —
 * something fast, something that reasons, something that must return JSON —
 * and the route table says which of AI API Manager's registered services
 * answers that, in what order, with what timeout and how many attempts.
 *
 * The order is not an opinion. It was seeded from the success history already
 * recorded in usage_events, and each row carries the sentence explaining its
 * position, so a provider that starts failing can be demoted with evidence
 * rather than argument.
 *
 * When no route resolves, this returns nothing and the caller reports
 * NO_PROVIDER. It never falls through to a hardcoded model, because a model
 * chosen in code is one nobody can change without a deployment and one that
 * quietly bypasses the manager that is supposed to own provider access.
 */

export type Capability = "FAST" | "BALANCED" | "REASONING" | "LONG_CONTEXT" | "STRUCTURED_OUTPUT";

export interface Route {
  serviceId: string;
  serviceName: string;
  priority: number;
  maxTokens: number | null;
  temperature: number | null;
  timeoutMs: number;
  maxAttempts: number;
  allowFallback: boolean;
  notes: string | null;
}

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * Every route for a capability, best first.
 *
 * The list is returned rather than just the winner, because a transport-level
 * failure on the first route is exactly when the second one matters — and
 * whether it may be used is the route's own decision, not the caller's.
 */
export async function routesFor(capability: Capability): Promise<Route[]> {
  const base = restUrl();
  if (!base) return [];

  try {
    const response = await fetch(
      `${base}/rest/v1/founder_ai_routes?select=*&enabled=is.true` +
        `&capability=eq.${capability}&order=priority.asc&limit=20`,
      { headers: restHeaders() },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as Row[];

    return rows.map((row) => ({
      serviceId: String(row.service_id),
      serviceName: str(row, "service_name") ?? String(row.service_id),
      priority: num(row, "priority") ?? 1,
      maxTokens: num(row, "max_tokens"),
      temperature: num(row, "temperature"),
      timeoutMs: num(row, "timeout_ms") ?? 45_000,
      maxAttempts: num(row, "max_attempts") ?? 2,
      allowFallback: row.allow_fallback !== false,
      notes: str(row, "notes"),
    }));
  } catch (error) {
    console.error("[founder/router] route lookup failed:", error);
    return [];
  }
}

/**
 * The capability a task needs.
 *
 * Kept as one table so that adding a task type is a one-line change and so
 * that nobody has to guess, in the middle of a feature, whether their job
 * needs the reasoning model.
 */
const TASK_CAPABILITY: Record<string, Capability> = {
  intent_classification: "FAST",
  summarise: "FAST",
  company_status: "BALANCED",
  kpi_explanation: "BALANCED",
  anomaly_explanation: "REASONING",
  root_cause: "REASONING",
  option_generation: "REASONING",
  risk_assessment: "REASONING",
  decision_recommendation: "STRUCTURED_OUTPUT",
  forecast: "REASONING",
  report: "LONG_CONTEXT",
};

export function capabilityFor(taskType: string, wantsJson = false): Capability {
  if (wantsJson) return "STRUCTURED_OUTPUT";
  return TASK_CAPABILITY[taskType] ?? "BALANCED";
}
