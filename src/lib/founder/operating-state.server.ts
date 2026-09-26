import {
  DOMAINS,
  freshnessOf,
  measuredFact,
  type AttentionItem,
  type Deadline,
  type Domain,
  type DomainHealth,
  type Goal,
  type Health,
  type Initiative,
  type Kpi,
  type OperatingState,
  type OperationalEvent,
  type PendingApproval,
  type Risk,
  type Severity,
  type WorkloadEntry,
} from "./state.types";

/**
 * Assembling the Company Operating State.
 *
 * The state is read from two places and invented in neither. What the company
 * is trying to do — goals, objectives, KPIs, initiatives, milestones, risks,
 * attention — lives in the founder_* tables. Everything else already existed
 * and is read where it lives: work in tm_tasks, dependencies in
 * tm_dependencies, capacity in tm_members, people in team_members, approvals in
 * the three approval tables, warnings in the twelve *_alerts tables. Nothing is
 * copied into a second home.
 *
 * Reads go over PostgREST rather than the generated Supabase client, because
 * the generated types cover 78 of this platform's 540 tables and almost none of
 * these are among them. The manager resource endpoint reached the same
 * conclusion, and this follows it.
 *
 * Every read is wrapped. One unreadable table degrades its own part of the
 * state and is named in `degraded`; it never fails the whole answer, and it
 * never quietly becomes an empty list — an empty list means the table was read
 * and held nothing, which is a different claim.
 */

const LIST_LIMIT = 200;
const ORGANISATION = "Software Vala";

type Row = Record<string, unknown>;
type Degraded = string[];

function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows(table: string, query: string): Promise<Row[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return (await response.json()) as Row[];
}

async function safe<T>(
  label: string,
  degraded: Degraded,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[founder/state] ${label} unavailable: ${message}`);
    degraded.push(label);
    return fallback;
  }
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

function health(row: Row, key = "health"): Health {
  const value = str(row, key);
  const allowed: Health[] = ["HEALTHY", "WATCH", "AT_RISK", "CRITICAL", "UNKNOWN"];
  return allowed.includes(value as Health) ? (value as Health) : "UNKNOWN";
}

function severity(row: Row, key = "severity"): Severity {
  const value = (str(row, key) ?? "").toUpperCase();
  const allowed: Severity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return allowed.includes(value as Severity) ? (value as Severity) : "INFO";
}

/**
 * A KPI's status, derived from its own thresholds.
 *
 * Section 12 of the brief is explicit that status must not be a label somebody
 * typed. With no reading there is no status but UNKNOWN, and with no thresholds
 * the honest answer is also UNKNOWN — a number with nothing to compare it to
 * cannot be healthy or critical, only present.
 */
function kpiStatus(value: number | null, row: Row): { status: Health; reason: string } {
  if (value === null) return { status: "UNKNOWN", reason: "no reading has been recorded" };

  const warnBelow = num(row, "warn_below");
  const criticalBelow = num(row, "critical_below");
  const warnAbove = num(row, "warn_above");
  const criticalAbove = num(row, "critical_above");

  if (criticalBelow !== null && value < criticalBelow) {
    return {
      status: "CRITICAL",
      reason: `${value} is below the critical threshold ${criticalBelow}`,
    };
  }
  if (criticalAbove !== null && value > criticalAbove) {
    return {
      status: "CRITICAL",
      reason: `${value} is above the critical threshold ${criticalAbove}`,
    };
  }
  if (warnBelow !== null && value < warnBelow) {
    return { status: "AT_RISK", reason: `${value} is below the warning threshold ${warnBelow}` };
  }
  if (warnAbove !== null && value > warnAbove) {
    return { status: "AT_RISK", reason: `${value} is above the warning threshold ${warnAbove}` };
  }
  if (
    warnBelow === null &&
    criticalBelow === null &&
    warnAbove === null &&
    criticalAbove === null
  ) {
    return {
      status: "UNKNOWN",
      reason: "no threshold is defined, so the reading cannot be judged",
    };
  }
  return { status: "HEALTHY", reason: "the reading is within every defined threshold" };
}

async function loadGoals(degraded: Degraded): Promise<Goal[]> {
  return safe(
    "founder_goals",
    degraded,
    async () => {
      const [goals, objectives] = await Promise.all([
        rows("founder_goals", `select=*&order=priority.asc&limit=${LIST_LIMIT}`),
        rows("founder_objectives", `select=*&limit=${LIST_LIMIT}`),
      ]);
      return goals.map((g) => ({
        id: String(g.id),
        title: str(g, "title") ?? String(g.id),
        domain: str(g, "domain") ?? "EXECUTIVE",
        ownerName: str(g, "owner_name"),
        targetOn: str(g, "target_on"),
        status: str(g, "status") ?? "active",
        priority: num(g, "priority") ?? 3,
        progress: num(g, "progress"),
        health: health(g),
        objectives: objectives
          .filter((o) => String(o.goal_id) === String(g.id))
          .map((o) => ({
            id: String(o.id),
            title: str(o, "title") ?? String(o.id),
            status: str(o, "status") ?? "active",
            priority: num(o, "priority") ?? 3,
            progress: num(o, "progress"),
            health: health(o),
          })),
      }));
    },
    [],
  );
}

async function loadKpis(degraded: Degraded): Promise<Kpi[]> {
  return safe(
    "founder_kpis",
    degraded,
    async () => {
      const defs = await rows("founder_kpis", `select=*&active=is.true&limit=${LIST_LIMIT}`);
      if (defs.length === 0) return [];

      // The latest reading per KPI. Ordered newest first and taken once, so a
      // KPI with a long history costs one request rather than one each.
      const readings = await rows(
        "founder_kpi_readings",
        `select=*&order=measured_at.desc&limit=${LIST_LIMIT * 5}`,
      );
      const latest = new Map<string, Row>();
      for (const r of readings) {
        const key = String(r.kpi_id);
        if (!latest.has(key)) latest.set(key, r);
      }

      return defs.map((d) => {
        const reading = latest.get(String(d.id));
        const staleAfter = num(d, "measurement_hours") ?? 24;
        const value = reading ? num(reading, "value") : null;
        const current = reading
          ? measuredFact<number>(
              value,
              str(reading, "measured_at"),
              str(reading, "source") ?? str(d, "source") ?? "unknown",
              str(reading, "method") ?? "unrecorded",
              staleAfter,
            )
          : measuredFact<number>(
              null,
              null,
              str(d, "source") ?? "unknown",
              "never measured",
              staleAfter,
            );

        // A stale reading cannot support a health claim; the status reverts to
        // UNKNOWN rather than reporting yesterday's answer as today's.
        const judged =
          current.freshness === "STALE"
            ? { status: "UNKNOWN" as Health, reason: "the most recent reading is too old to judge" }
            : kpiStatus(current.value, d);

        return {
          id: String(d.id),
          key: str(d, "key") ?? String(d.id),
          name: str(d, "name") ?? String(d.id),
          definition: str(d, "definition") ?? "",
          unit: str(d, "unit") ?? "",
          domain: str(d, "domain") ?? "EXECUTIVE",
          source: str(d, "source") ?? "unknown",
          target: num(d, "target_value"),
          baseline: num(d, "baseline_value"),
          current,
          status: judged.status,
          statusReason: judged.reason,
          higherIsBetter: d.higher_is_better !== false,
        };
      });
    },
    [],
  );
}

async function loadInitiatives(degraded: Degraded): Promise<Initiative[]> {
  return safe(
    "founder_initiatives",
    degraded,
    async () => {
      const [items, milestones, links] = await Promise.all([
        rows("founder_initiatives", `select=*&order=priority.asc&limit=${LIST_LIMIT}`),
        rows("founder_milestones", `select=*&limit=${LIST_LIMIT}`),
        rows("founder_initiative_tasks", `select=*&limit=${LIST_LIMIT}`),
      ]);
      return items.map((i) => ({
        id: String(i.id),
        title: str(i, "title") ?? String(i.id),
        domain: str(i, "domain"),
        ownerName: str(i, "owner_name"),
        status: str(i, "status") ?? "planned",
        priority: num(i, "priority") ?? 3,
        targetOn: str(i, "target_on"),
        progress: num(i, "progress"),
        health: health(i),
        milestones: milestones
          .filter((m) => String(m.initiative_id) === String(i.id))
          .map((m) => ({
            id: String(m.id),
            title: str(m, "title") ?? String(m.id),
            dueOn: str(m, "due_on"),
            status: str(m, "status") ?? "open",
            blockedReason: str(m, "blocked_reason"),
            hasEvidence: JSON.stringify(m.evidence ?? {}) !== "{}",
          })),
        taskIds: links
          .filter((l) => String(l.initiative_id) === String(i.id))
          .map((l) => String(l.task_id)),
      }));
    },
    [],
  );
}

async function loadRisks(degraded: Degraded): Promise<Risk[]> {
  return safe(
    "founder_risks",
    degraded,
    async () => {
      const items = await rows(
        "founder_risks",
        `select=*&status=neq.resolved&order=detected_at.desc&limit=${LIST_LIMIT}`,
      );
      return items.map((r) => ({
        id: String(r.id),
        title: str(r, "title") ?? String(r.id),
        domain: str(r, "domain") ?? "EXECUTIVE",
        severity: severity(r),
        likelihood: num(r, "likelihood"),
        status: str(r, "status") ?? "open",
        source: str(r, "source") ?? "unknown",
        detectedAt: str(r, "detected_at") ?? "",
      }));
    },
    [],
  );
}

async function loadAttention(degraded: Degraded): Promise<AttentionItem[]> {
  return safe(
    "founder_attention",
    degraded,
    async () => {
      const items = await rows(
        "founder_attention",
        `select=*&status=in.(NEW,ACKNOWLEDGED,IN_PROGRESS)&order=severity.desc,created_at.desc&limit=${LIST_LIMIT}`,
      );
      return items.map((a) => ({
        id: String(a.id),
        kind: str(a, "kind") ?? "",
        domain: str(a, "domain") ?? "EXECUTIVE",
        title: str(a, "title") ?? String(a.id),
        reason: str(a, "reason") ?? "",
        severity: severity(a),
        priority: num(a, "priority") ?? 3,
        status: str(a, "status") ?? "NEW",
        sourceSystem: str(a, "source_system") ?? "unknown",
        createdAt: str(a, "created_at") ?? "",
        acknowledgedAt: str(a, "acknowledged_at"),
      }));
    },
    [],
  );
}

const DONE_STATES = new Set(["done", "closed", "cancelled", "completed", "delivered", "verified"]);

/**
 * Deadlines, and whether each one is actually safe.
 *
 * A date on its own is not intelligence. This reads tm_dependencies alongside
 * the dates so an item due tomorrow whose blocker has not started is reported
 * as at risk and says which blocker, which is the sentence an executive can
 * act on.
 */
async function loadDeadlines(degraded: Degraded): Promise<Deadline[]> {
  const tasks = await safe(
    "tm_tasks",
    degraded,
    () =>
      rows(
        "tm_tasks",
        `select=id,code,title,status,deadline,promised_at,blocked_reason&order=deadline.asc&limit=${LIST_LIMIT}`,
      ),
    [] as Row[],
  );
  const deps = await safe(
    "tm_dependencies",
    degraded,
    () => rows("tm_dependencies", `select=task_id,depends_on_task_id,status&limit=${LIST_LIMIT}`),
    [] as Row[],
  );
  const milestones = await safe(
    "founder_milestones",
    degraded,
    () =>
      rows(
        "founder_milestones",
        `select=id,title,due_on,status,blocked_reason&limit=${LIST_LIMIT}`,
      ),
    [] as Row[],
  );

  const byId = new Map(tasks.map((t) => [String(t.id), t]));
  const blockersOf = new Map<string, string[]>();
  for (const d of deps) {
    const task = String(d.task_id);
    const on = byId.get(String(d.depends_on_task_id));
    const onDone = on ? DONE_STATES.has((str(on, "status") ?? "").toLowerCase()) : false;
    if (!onDone) {
      const label = on
        ? (str(on, "code") ?? str(on, "title") ?? String(on.id))
        : String(d.depends_on_task_id);
      blockersOf.set(task, [...(blockersOf.get(task) ?? []), label]);
    }
  }

  const now = Date.now();
  const soonMs = 3 * 24 * 3_600_000;

  function judge(
    dueOn: string | null,
    status: string,
    blockedReason: string | null,
    blockers: string[],
  ) {
    if (DONE_STATES.has(status.toLowerCase())) return { state: "DONE", reason: "already finished" };
    if (!dueOn) return { state: "SCHEDULED", reason: "no date is set" };
    const due = new Date(dueOn).getTime();
    if (!Number.isFinite(due))
      return { state: "SCHEDULED", reason: "the recorded date cannot be read" };
    if (due < now)
      return { state: "OVERDUE", reason: "the date has passed and the work is not finished" };
    if (blockers.length > 0) {
      return { state: "AT_RISK", reason: `blocked on ${blockers.slice(0, 3).join(", ")}` };
    }
    if (blockedReason) return { state: "AT_RISK", reason: blockedReason };
    if (due - now <= soonMs) return { state: "DUE_SOON", reason: "due within three days" };
    return { state: "SCHEDULED", reason: "on track with nothing blocking it" };
  }

  // Annotated rather than inferred: `kind` narrows to a single literal here,
  // which would make the element type too specific for the Deadline guard
  // below to be assignable to it.
  const fromTasks: Deadline[] = tasks
    .map((t): Deadline | null => {
      const dueOn = str(t, "deadline") ?? str(t, "promised_at");
      if (!dueOn) return null;
      const blockers = blockersOf.get(String(t.id)) ?? [];
      const status = str(t, "status") ?? "unknown";
      const judged = judge(dueOn, status, str(t, "blocked_reason"), blockers);
      return {
        id: String(t.id),
        title: `${str(t, "code") ? `${str(t, "code")} · ` : ""}${str(t, "title") ?? String(t.id)}`,
        dueOn,
        kind: "task" as const,
        status,
        state: judged.state,
        reason: judged.reason,
        blockedBy: blockers,
      };
    })
    .filter((d): d is Deadline => d !== null);

  const fromMilestones: Deadline[] = milestones
    .map((m): Deadline | null => {
      const dueOn = str(m, "due_on");
      if (!dueOn) return null;
      const status = str(m, "status") ?? "open";
      const judged = judge(dueOn, status, str(m, "blocked_reason"), []);
      return {
        id: String(m.id),
        title: str(m, "title") ?? String(m.id),
        dueOn,
        kind: "milestone" as const,
        status,
        state: judged.state,
        reason: judged.reason,
        blockedBy: [],
      };
    })
    .filter((d): d is Deadline => d !== null);

  return [...fromTasks, ...fromMilestones].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/**
 * Who is carrying what.
 *
 * Capacity comes from tm_members where it has been recorded, and is null where
 * it has not. A workload state of UNKNOWN is returned rather than guessing that
 * somebody with no recorded capacity is available.
 */
async function loadWorkload(degraded: Degraded): Promise<WorkloadEntry[]> {
  const tasks = await safe(
    "tm_tasks",
    degraded,
    () =>
      rows(
        "tm_tasks",
        `select=id,assigned_to,status,deadline,promised_at,estimated_hours,blocked_reason&limit=${LIST_LIMIT}`,
      ),
    [] as Row[],
  );
  const members = await safe(
    "tm_members",
    degraded,
    () =>
      rows(
        "tm_members",
        `select=user_id,full_name,department,capacity_hours,active&limit=${LIST_LIMIT}`,
      ),
    [] as Row[],
  );
  const people = await safe(
    "team_members",
    degraded,
    () => rows("team_members", `select=id,full_name,department,status&limit=${LIST_LIMIT}`),
    [] as Row[],
  );

  const capacity = new Map<string, Row>();
  for (const m of members) {
    const key = str(m, "user_id");
    if (key) capacity.set(key, m);
  }

  const buckets = new Map<string, WorkloadEntry>();
  const now = Date.now();

  function bucket(
    ownerId: string | null,
    ownerName: string,
    department: string | null,
  ): WorkloadEntry {
    const key = ownerId ?? `name:${ownerName}`;
    const existing = buckets.get(key);
    if (existing) return existing;
    const member = ownerId ? capacity.get(ownerId) : undefined;
    const entry: WorkloadEntry = {
      ownerId,
      ownerName,
      department: department ?? (member ? str(member, "department") : null),
      assigned: 0,
      active: 0,
      blocked: 0,
      overdue: 0,
      capacityHours: member ? num(member, "capacity_hours") : null,
      estimatedHours: null,
      state: "UNKNOWN",
    };
    buckets.set(key, entry);
    return entry;
  }

  // Everyone the team register knows about appears, even with no work, so an
  // empty column reads as "nothing assigned" rather than "person missing".
  for (const p of people) {
    if ((str(p, "status") ?? "active").toLowerCase() === "inactive") continue;
    bucket(null, str(p, "full_name") ?? String(p.id), str(p, "department"));
  }

  for (const t of tasks) {
    const owner = str(t, "assigned_to");
    const member = owner ? capacity.get(owner) : undefined;
    const name = member ? (str(member, "full_name") ?? owner!) : (owner ?? "unassigned");
    const entry = bucket(owner, name, member ? str(member, "department") : null);
    const status = (str(t, "status") ?? "").toLowerCase();
    if (DONE_STATES.has(status)) continue;

    entry.assigned += 1;
    if (status === "in_progress" || status === "running" || status === "active") entry.active += 1;
    if (str(t, "blocked_reason") || status === "blocked") entry.blocked += 1;

    const due = str(t, "deadline") ?? str(t, "promised_at");
    if (due) {
      const at = new Date(due).getTime();
      if (Number.isFinite(at) && at < now) entry.overdue += 1;
    }
    const hours = num(t, "estimated_hours");
    if (hours !== null) entry.estimatedHours = (entry.estimatedHours ?? 0) + hours;
  }

  for (const entry of buckets.values()) {
    if (entry.capacityHours === null || entry.estimatedHours === null) {
      // No capacity recorded means no judgement is possible. Saying "available"
      // here would be the invented state the brief forbids.
      entry.state = entry.assigned === 0 ? "AVAILABLE" : "UNKNOWN";
      continue;
    }
    if (entry.estimatedHours > entry.capacityHours) entry.state = "OVERLOADED";
    else if (entry.estimatedHours < entry.capacityHours * 0.5) entry.state = "AVAILABLE";
    else entry.state = "BALANCED";
  }

  return [...buckets.values()].sort((a, b) => b.assigned - a.assigned);
}

async function loadRecentEvents(degraded: Degraded): Promise<OperationalEvent[]> {
  return safe(
    "founder_events",
    degraded,
    async () => {
      const items = await rows("founder_events", `select=*&order=occurred_at.desc&limit=50`);
      return items.map((e) => ({
        id: String(e.id),
        eventType: str(e, "event_type") ?? "",
        domain: str(e, "domain") ?? "EXECUTIVE",
        severity: severity(e),
        occurredAt: str(e, "occurred_at") ?? "",
        receivedAt: str(e, "received_at") ?? "",
        sourceSystem: str(e, "source_system") ?? "",
        entityType: str(e, "entity_type"),
        entityId: str(e, "entity_id"),
        actorKind: (str(e, "actor_type") ?? "SYSTEM") as OperationalEvent["actorKind"],
      }));
    },
    [],
  );
}

/** Approvals still waiting, across the three tables that hold them. */
async function loadPendingApprovals(degraded: Degraded): Promise<PendingApproval[]> {
  const specs = [
    { table: "tm_approvals", title: "title", at: "created_at" },
    { table: "finance_approvals", title: "title", at: "created_at" },
    { table: "assist_approvals", title: "title", at: "created_at" },
  ];
  const lists = await Promise.all(
    specs.map((spec) =>
      safe(
        spec.table,
        degraded,
        async () => {
          const items = await rows(spec.table, `select=*&order=${spec.at}.desc&limit=50`);
          return items
            .filter((r) => {
              const status = (str(r, "status") ?? "pending").toLowerCase();
              return status === "pending" || status === "awaiting" || status === "requested";
            })
            .map((r) => ({
              id: `${spec.table}:${String(r.id)}`,
              title: str(r, spec.title) ?? str(r, "reason") ?? String(r.id),
              sourceSystem: spec.table,
              requestedAt: str(r, spec.at),
              status: str(r, "status") ?? "pending",
            }));
        },
        [] as PendingApproval[],
      ),
    ),
  );
  return lists.flat();
}

/**
 * Health per business lens.
 *
 * Derived from what is open against that domain, never asserted. A domain with
 * nothing recorded is UNKNOWN, not healthy — the absence of warnings is not the
 * same as evidence of health, and an executive dashboard that conflates the two
 * is how a quiet failure stays quiet.
 */
function deriveHealth(attention: AttentionItem[], kpis: Kpi[]): DomainHealth[] {
  return DOMAINS.map((domain): DomainHealth => {
    const open = attention.filter((a) => a.domain === domain);
    const critical = open.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH");
    const domainKpis = kpis.filter((k) => k.domain === domain);
    const atRisk = domainKpis.filter((k) => k.status === "AT_RISK" || k.status === "CRITICAL");

    if (open.length === 0 && domainKpis.length === 0) {
      return {
        domain: domain as Domain,
        health: "UNKNOWN",
        reason: "nothing is measured or recorded against this domain yet",
        openAttention: 0,
        criticalAttention: 0,
        kpisAtRisk: 0,
      };
    }

    let value: Health = "HEALTHY";
    let reason = "no open attention and no KPI outside its thresholds";
    if (critical.length > 0) {
      value = "CRITICAL";
      reason = `${critical.length} high or critical item${critical.length === 1 ? "" : "s"} open`;
    } else if (atRisk.length > 0) {
      value = "AT_RISK";
      reason = `${atRisk.length} KPI${atRisk.length === 1 ? "" : "s"} outside threshold`;
    } else if (open.length > 0) {
      value = "WATCH";
      reason = `${open.length} item${open.length === 1 ? "" : "s"} open, none critical`;
    }

    return {
      domain: domain as Domain,
      health: value,
      reason,
      openAttention: open.length,
      criticalAttention: critical.length,
      kpisAtRisk: atRisk.length,
    };
  });
}

/** The whole state, in one pass. */
export async function loadOperatingState(): Promise<OperatingState> {
  const degraded: Degraded = [];

  const [goals, kpis, initiatives, risks, attention, deadlines, workload, recentEvents, approvals] =
    await Promise.all([
      loadGoals(degraded),
      loadKpis(degraded),
      loadInitiatives(degraded),
      loadRisks(degraded),
      loadAttention(degraded),
      loadDeadlines(degraded),
      loadWorkload(degraded),
      loadRecentEvents(degraded),
      loadPendingApprovals(degraded),
    ]);

  const newestEvent = recentEvents[0]?.occurredAt ?? null;
  const newestAttention = attention[0]?.createdAt ?? null;
  const newestKpi =
    kpis
      .map((k) => k.current.measuredAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  return {
    organization: { name: ORGANISATION, tenancy: "SINGLE_TENANT", organizationId: null },
    builtAt: new Date().toISOString(),
    goals,
    kpis,
    initiatives,
    risks,
    attention,
    deadlines,
    workload,
    health: deriveHealth(attention, kpis),
    recentEvents,
    pendingApprovals: approvals,
    sources: {
      goals: { source: "founder_goals", measuredAt: null, freshness: "UNKNOWN" },
      kpis: {
        source: "founder_kpi_readings",
        measuredAt: newestKpi,
        freshness: freshnessOf(newestKpi),
      },
      attention: {
        source: "founder_attention",
        measuredAt: newestAttention,
        freshness: freshnessOf(newestAttention),
      },
      events: {
        source: "founder_events",
        measuredAt: newestEvent,
        freshness: freshnessOf(newestEvent),
      },
      work: { source: "tm_tasks + tm_dependencies", measuredAt: null, freshness: "UNKNOWN" },
      people: { source: "team_members + tm_members", measuredAt: null, freshness: "UNKNOWN" },
      approvals: {
        source: "tm_approvals + finance_approvals + assist_approvals",
        measuredAt: null,
        freshness: "UNKNOWN",
      },
    },
    degraded: [...new Set(degraded)],
  };
}
