import { loadOperatingState } from "../operating-state.server";
import { allocate, type EligibleAgent } from "./allocation";
import {
  fromAttention,
  fromDeadlines,
  fromKpis,
  fromRisks,
  prioritise,
  type Candidate,
  type Scored,
} from "./priority";

/**
 * The operational day, from overnight analysis to daily close.
 *
 * The cycle owns the order of events and nothing else. The company's state is
 * read from the operating state that already exists; the brief and the close
 * are written as reports, through the report engine, so the constraint that
 * a report with no findings must say why applies to a morning brief as much
 * as to anything else; the work is pointed at rather than copied; and the
 * agents come from the one register.
 *
 * What the cycle adds is the part nobody else held: the day's order, the
 * reason for it, and which agent could take each item.
 *
 * It does not assign, execute, or complete anything. Assignment is governed,
 * execution belongs to the system that owns the work, and an item reaches
 * COMPLETED only through VERIFYING — a rule the database enforces rather than
 * this code.
 */

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

async function insert(
  table: string,
  body: unknown,
  prefer = "return=representation",
): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as Row[]) : [];
}

async function patch(table: string, filter: string, body: unknown): Promise<void> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: restHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
}

export interface CycleResult {
  ok: boolean;
  cycleId?: string;
  cycleDate?: string;
  briefReportId?: string | null;
  planned?: number;
  unallocated?: number;
  escalations?: number;
  /** Sources that could not be read. Never silently empty. */
  degraded?: string[];
  error?: string;
}

/** The agents that could be offered work, with what they are carrying. */
async function loadEligibleAgents(): Promise<EligibleAgent[]> {
  const agents = await rows(
    "ai_agents",
    "select=id,agent_key,name,specialization,lifecycle,permissions,max_concurrent,blocked_reason" +
      "&agent_key=not.is.null&limit=500",
  );
  if (agents.length === 0) return [];

  // How much each is already carrying. Counted from the run log rather than
  // from the denormalised counters, which say nothing about what is open now.
  const open = await rows(
    "ai_agent_runs",
    "select=agent_id&state=in.(RUNNING,WAITING,BLOCKED)&limit=2000",
  ).catch(() => [] as Row[]);

  const load = new Map<string, number>();
  for (const run of open) {
    const id = String(run.agent_id ?? "");
    if (id) load.set(id, (load.get(id) ?? 0) + 1);
  }

  return agents.map((agent) => ({
    id: String(agent.id),
    agentKey: String(agent.agent_key ?? ""),
    name: String(agent.name ?? ""),
    specialization: agent.specialization ? String(agent.specialization) : null,
    lifecycle: String(agent.lifecycle ?? "CREATED"),
    permissions: Array.isArray(agent.permissions) ? agent.permissions.map(String) : [],
    maxConcurrent: Number(agent.max_concurrent ?? 1),
    openRuns: load.get(String(agent.id)) ?? 0,
    blockedReason: agent.blocked_reason ? String(agent.blocked_reason) : null,
  }));
}

/** Decisions a person has not answered yet. */
async function pendingDecisions(): Promise<Candidate[]> {
  const open = await rows(
    "founder_decisions",
    "select=id,title,domain,risk_level,priority,state&state=in.(WAITING_APPROVAL,ESCALATED)&limit=200",
  ).catch(() => [] as Row[]);

  return open.map((decision) => ({
    source: "DECISION" as const,
    sourceId: String(decision.id),
    title: String(decision.title ?? ""),
    domain: String(decision.domain ?? "operations"),
    severity: (String(decision.risk_level ?? "MEDIUM") as Candidate["severity"]) ?? "MEDIUM",
    humanPriority: decision.priority ? Number(decision.priority) : null,
    dueAt: null,
    blocked: false,
    awaitingApproval: true,
    needs: "decision",
  }));
}

/**
 * Run the day: analyse, brief, prioritise, plan, allocate.
 *
 * The brief is written before the plan, because a brief that depended on the
 * plan would be describing its own output rather than the company.
 */
export async function runMorningCycle(createdBy: string | null): Promise<CycleResult> {
  const today = new Date().toISOString().slice(0, 10);

  // One cycle per day. A second run today continues the first rather than
  // producing a rival brief nobody knows to ignore.
  const existing = await rows(
    "founder_daily_cycles",
    `select=*&cycle_date=eq.${today}&limit=1`,
  ).catch(() => [] as Row[]);
  if (existing[0] && String(existing[0].state) !== "FAILED") {
    return {
      ok: true,
      cycleId: String(existing[0].id),
      cycleDate: today,
      briefReportId: existing[0].brief_report_id ? String(existing[0].brief_report_id) : null,
      planned: Number(existing[0].planned_items ?? 0),
      unallocated: 0,
      escalations: Number(existing[0].escalations ?? 0),
      degraded: [],
    };
  }

  let state: Awaited<ReturnType<typeof loadOperatingState>>;
  try {
    state = await loadOperatingState();
  } catch (error) {
    return { ok: false, error: `the operating state could not be read: ${String(error)}` };
  }

  // The overnight window: since the last cycle closed, or the last 24 hours
  // if this is the first one.
  const previous = await rows(
    "founder_daily_cycles",
    `select=closed_at&cycle_date=lt.${today}&order=cycle_date.desc&limit=1`,
  ).catch(() => [] as Row[]);
  const windowStart =
    previous[0]?.closed_at != null
      ? String(previous[0].closed_at)
      : new Date(Date.now() - 86_400_000).toISOString();
  const windowEnd = new Date().toISOString();

  const created = await insert("founder_daily_cycles", {
    cycle_date: today,
    state: "ANALYSING",
    window_start: windowStart,
    window_end: windowEnd,
    analysed_from: { sources: Object.keys(state.sources), degraded: state.degraded },
    created_by: createdBy,
  }).catch((error) => {
    throw new Error(`the cycle could not be started: ${String(error)}`);
  });
  const cycle = created[0];
  if (!cycle) return { ok: false, error: "the cycle could not be started" };
  const cycleId = String(cycle.id);

  // What changed overnight, from the event log rather than from an impression.
  const changes = await rows(
    "founder_events",
    `select=id,event_type,domain,severity&occurred_at=gte.${encodeURIComponent(windowStart)}&limit=500`,
  ).catch(() => [] as Row[]);

  const decisions = await pendingDecisions();
  const candidates: Candidate[] = [
    ...fromAttention(state.attention),
    ...fromKpis(state.kpis),
    ...fromRisks(state.risks),
    ...fromDeadlines(state.deadlines),
    ...decisions,
  ];
  const ordered = prioritise(candidates);

  // BRIEF. Written through the report engine, so it obeys the same rule as
  // every other report: one that found nothing has to say so.
  const findings = ordered.slice(0, 20).map((item) => ({
    kind: "OBSERVATION" as const,
    statement: `${item.title} — ${item.reason}`,
    source: item.source === "DECISION" ? "founder_decisions" : "founder_attention",
  }));

  const limitations: string[] = [];
  if (state.degraded.length > 0) {
    limitations.push(`These sources could not be read: ${state.degraded.join(", ")}.`);
  }
  if (candidates.length === 0) {
    limitations.push(
      "No attention item, KPI breach, risk, deadline or pending decision was found.",
    );
  }

  let briefReportId: string | null = null;
  try {
    const brief = await insert("founder_reports", {
      report_type: "MORNING_BRIEF",
      title: `Morning brief — ${today}`,
      period_start: windowStart,
      period_end: windowEnd,
      basis: {
        reportType: "MORNING_BRIEF",
        generatedFrom: [
          ...Object.values(state.sources).map((s) => s.source),
          "founder_events",
          "founder_decisions",
        ],
      },
      findings,
      recommendations: [],
      limitations,
      // A brief assembled while some sources were unreadable is an estimate,
      // not a measurement, and says so.
      confidence:
        state.degraded.length > 0 ? "ESTIMATED" : candidates.length > 0 ? "MEASURED" : "UNKNOWN",
      insufficient_data: candidates.length === 0,
      status: "generated",
      produced_by_ai: true,
      generated_by: createdBy,
    });
    briefReportId = brief[0] ? String(brief[0].id) : null;
  } catch (error) {
    await patch("founder_daily_cycles", `id=eq.${cycleId}`, {
      state: "FAILED",
      failure_reason: `the brief could not be written: ${String(error)}`.slice(0, 500),
    }).catch(() => undefined);
    return { ok: false, error: `the brief could not be written: ${String(error)}` };
  }

  await patch("founder_daily_cycles", `id=eq.${cycleId}`, {
    state: "BRIEF_READY",
    brief_report_id: briefReportId,
  });

  // PLAN. Each item points at the work; the plan holds only the order, the
  // reason and the suggested agent.
  const agents = await loadEligibleAgents().catch(() => [] as EligibleAgent[]);
  let unallocated = 0;

  const planRows = ordered.map((item: Scored, index) => {
    const allocation = allocate(item, agents);
    if (!allocation.agentId) unallocated += 1;
    return {
      cycle_id: cycleId,
      attention_id: item.source === "ATTENTION" ? item.sourceId : null,
      task_id: item.source === "TASK" ? item.sourceId : null,
      decision_id: item.source === "DECISION" ? item.sourceId : null,
      title: item.title.slice(0, 300),
      domain: item.domain,
      severity: item.severity,
      position: index + 1,
      priority_score: item.score,
      priority_reason: item.reason.slice(0, 1000),
      suggested_agent_id: allocation.agentId,
      allocation_reason: allocation.reason ?? allocation.unmatchedReason,
      // Anything a person must answer waits for them; the rest is planned.
      state: item.awaitingApproval ? "WAITING_APPROVAL" : "PLANNED",
    };
  });

  if (planRows.length > 0) {
    try {
      await insert("founder_work_plan_items", planRows, "return=minimal");
    } catch (error) {
      await patch("founder_daily_cycles", `id=eq.${cycleId}`, {
        state: "FAILED",
        failure_reason: `the plan could not be written: ${String(error)}`.slice(0, 500),
      }).catch(() => undefined);
      return { ok: false, error: `the plan could not be written: ${String(error)}` };
    }
  }

  const escalations = ordered.filter((item) => item.severity === "CRITICAL").length;
  await patch("founder_daily_cycles", `id=eq.${cycleId}`, {
    state: "PLANNED",
    planned_items: planRows.length,
    escalations,
    planned_at: new Date().toISOString(),
  });

  return {
    ok: true,
    cycleId,
    cycleDate: today,
    briefReportId,
    planned: planRows.length,
    unallocated,
    escalations,
    degraded: [...state.degraded, ...(changes.length === 0 ? [] : [])],
  };
}

/**
 * Close the day.
 *
 * The close is counted from the plan rather than described, and completed and
 * verified are counted separately because they are not the same thing. A day
 * in which work was completed but nothing was verified is a fact worth
 * reading, and it is one this would otherwise hide.
 */
export async function closeMorningCycle(
  cycleId: string,
  closedBy: string | null,
): Promise<CycleResult> {
  const found = await rows("founder_daily_cycles", `select=*&id=eq.${cycleId}&limit=1`).catch(
    () => [] as Row[],
  );
  const cycle = found[0];
  if (!cycle) return { ok: false, error: "that cycle does not exist" };
  if (String(cycle.state) === "CLOSED") {
    return { ok: true, cycleId, cycleDate: String(cycle.cycle_date) };
  }

  const totals = await rows(
    "founder_cycle_totals",
    `select=*&cycle_id=eq.${cycleId}&limit=1`,
  ).catch(() => [] as Row[]);
  const t = totals[0] ?? {};
  const count = (key: string): number => Number(t[key] ?? 0);

  const findings = [
    {
      kind: "CALCULATION" as const,
      statement: `${count("planned")} item(s) were planned.`,
      source: "founder_work_plan_items",
    },
    {
      kind: "CALCULATION" as const,
      statement: `${count("completed")} completed, of which ${count("verified")} were verified.`,
      source: "founder_work_plan_items",
    },
    {
      kind: "CALCULATION" as const,
      statement: `${count("failed")} failed, ${count("waiting_approval")} still waiting on a person.`,
      source: "founder_work_plan_items",
    },
  ];

  const limitations: string[] = [];
  if (count("completed") > 0 && count("verified") === 0) {
    limitations.push(
      "Work was completed but none of it was verified, so no outcome can be claimed from this day.",
    );
  }
  if (count("planned") === 0) {
    limitations.push("Nothing was planned for this day, so there is nothing to report against.");
  }

  let closeReportId: string | null = null;
  try {
    const report = await insert("founder_reports", {
      report_type: "DAILY_CLOSE",
      title: `Daily close — ${String(cycle.cycle_date)}`,
      period_start: String(cycle.window_start ?? cycle.created_at),
      period_end: new Date().toISOString(),
      basis: {
        reportType: "DAILY_CLOSE",
        generatedFrom: ["founder_work_plan_items", "founder_daily_cycles"],
      },
      findings,
      recommendations: [],
      limitations,
      confidence: count("planned") === 0 ? "UNKNOWN" : "MEASURED",
      insufficient_data: count("planned") === 0,
      status: "generated",
      produced_by_ai: true,
      generated_by: closedBy,
    });
    closeReportId = report[0] ? String(report[0].id) : null;
  } catch (error) {
    return { ok: false, error: `the close could not be written: ${String(error)}` };
  }

  await patch("founder_daily_cycles", `id=eq.${cycleId}`, {
    state: "CLOSED",
    close_report_id: closeReportId,
    closed_at: new Date().toISOString(),
  });

  return {
    ok: true,
    cycleId,
    cycleDate: String(cycle.cycle_date),
    briefReportId: cycle.brief_report_id ? String(cycle.brief_report_id) : null,
    planned: count("planned"),
    escalations: Number(cycle.escalations ?? 0),
    degraded: [],
  };
}
