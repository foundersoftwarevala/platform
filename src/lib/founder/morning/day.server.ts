import type { DayView, PlanItem } from "./morning.functions";

/**
 * Today, as a screen reads it.
 *
 * The counts come from founder_cycle_totals, which counts in SQL. They are
 * not derived from the items this returns, because that list is capped and a
 * count taken from a capped list stops being true the moment the plan grows
 * past it.
 *
 * A day that has not been run is not an error and is not an empty plan: it is
 * a day with no cycle, and the screen is told exactly that so it can offer to
 * run one rather than implying the company has nothing to do.
 */

type Row = Record<string, unknown>;

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status}`);
  return (await response.json()) as Row[];
}

const EMPTY: DayView = {
  cycleId: null,
  cycleDate: null,
  state: null,
  plannedItems: 0,
  escalations: 0,
  completed: 0,
  verified: 0,
  waitingApproval: 0,
  failed: 0,
  items: [],
  briefFindings: [],
  briefLimitations: [],
  insufficientData: false,
  degraded: [],
};

export async function loadDay(): Promise<DayView> {
  const today = new Date().toISOString().slice(0, 10);
  const degraded: string[] = [];

  let cycle: Row | undefined;
  try {
    const found = await rows("founder_daily_cycles", `select=*&cycle_date=eq.${today}&limit=1`);
    cycle = found[0];
  } catch {
    // Not knowing whether a cycle ran is different from knowing none did.
    return { ...EMPTY, degraded: ["founder_daily_cycles"] };
  }
  if (!cycle) return EMPTY;

  const cycleId = String(cycle.id);

  const [totals, items, brief] = await Promise.all([
    rows("founder_cycle_totals", `select=*&cycle_id=eq.${cycleId}&limit=1`).catch(() => {
      degraded.push("founder_cycle_totals");
      return [] as Row[];
    }),
    rows(
      "founder_work_plan_items",
      `select=*&cycle_id=eq.${cycleId}&order=position.asc&limit=200`,
    ).catch(() => {
      degraded.push("founder_work_plan_items");
      return [] as Row[];
    }),
    cycle.brief_report_id
      ? rows(
          "founder_reports",
          `select=findings,limitations,insufficient_data&id=eq.${String(cycle.brief_report_id)}&limit=1`,
        ).catch(() => {
          degraded.push("founder_reports");
          return [] as Row[];
        })
      : Promise.resolve([] as Row[]),
  ]);

  // The agents named in the plan, so the screen can show a name rather than
  // a uuid. One request, not one per row.
  const agentIds = [
    ...new Set(items.map((i) => String(i.suggested_agent_id ?? "")).filter(Boolean)),
  ];
  const agentNames = new Map<string, string>();
  if (agentIds.length > 0) {
    const list = agentIds.map((id) => `"${id}"`).join(",");
    const agents = await rows("ai_agents", `select=id,name&id=in.(${list})&limit=200`).catch(
      () => [] as Row[],
    );
    for (const agent of agents) agentNames.set(String(agent.id), String(agent.name ?? ""));
  }

  const t = totals[0] ?? {};
  const count = (key: string): number => Number(t[key] ?? 0);

  const briefRow = brief[0];
  const findings = Array.isArray(briefRow?.findings)
    ? (briefRow.findings as { statement?: unknown }[]).map((f) => String(f.statement ?? ""))
    : [];
  const limitations = Array.isArray(briefRow?.limitations)
    ? (briefRow.limitations as unknown[]).map(String)
    : [];

  return {
    cycleId,
    cycleDate: String(cycle.cycle_date ?? today),
    state: String(cycle.state ?? ""),
    plannedItems: count("planned"),
    escalations: Number(cycle.escalations ?? 0),
    completed: count("completed"),
    // Counted apart from completed on purpose: finishing is not verifying.
    verified: count("verified"),
    waitingApproval: count("waiting_approval"),
    failed: count("failed"),
    items: items.map((row): PlanItem => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      domain: String(row.domain ?? ""),
      severity: String(row.severity ?? "LOW"),
      position: Number(row.position ?? 0),
      priorityScore: Number(row.priority_score ?? 0),
      priorityReason: String(row.priority_reason ?? ""),
      suggestedAgentId: row.suggested_agent_id ? String(row.suggested_agent_id) : null,
      suggestedAgentName: row.suggested_agent_id
        ? (agentNames.get(String(row.suggested_agent_id)) ?? null)
        : null,
      allocationReason: row.allocation_reason ? String(row.allocation_reason) : null,
      state: String(row.state ?? "PLANNED"),
      verification: String(row.verification ?? "UNVERIFIED"),
    })),
    briefFindings: findings,
    briefLimitations: limitations,
    insufficientData: briefRow?.insufficient_data === true,
    degraded,
  };
}
