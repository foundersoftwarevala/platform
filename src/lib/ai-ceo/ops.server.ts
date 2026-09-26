import type { Degraded } from "./signals.server";
import type {
  CEOAgent,
  CEOAutomation,
  CEOInsight,
  CEONotification,
  CEOOpsState,
  CEOOpsSummary,
  CEOSecurityRow,
  CEOTask,
  CEOUsageRow,
} from "./ops.types";

/**
 * The AI CEO's operational reads.
 *
 * The imported module shipped these screens with their records written into
 * the component — an agent directory of eight invented agents, a task centre
 * of five invented tasks — under a note saying a runtime API would arrive
 * later. Each list below is read from a table the platform already has.
 *
 * Two consequences are deliberate. A list can come back empty, and that is
 * reported as an empty list rather than filled in: `ai_agents` holds nothing
 * today, so the agent directory shows nothing today. And a figure with no
 * source stays null, so a tile shows a dash instead of a number nobody
 * measured.
 *
 * Every read is wrapped: one unavailable table degrades its own list and is
 * named in `degraded`, rather than failing the whole console.
 */

const LIST_LIMIT = 200;

/** Where each list comes from, shown under its heading. */
export const OPS_SOURCES: Record<string, string> = {
  agents: "ai_agents",
  tasks: "tm_tasks",
  automations: "automation_rules + marketing_automations + seo_automations + tm_automations",
  notifications: "notifications",
  usage: "finance_ai_api_usage + usage_daily",
  security: "security_alerts + security_findings",
  insights: "promise_ai_insights + server_ai_insights",
};

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
    console.error(`[ai-ceo/ops] ${label} unavailable: ${message}`);
    degraded.push(label);
    return fallback;
  }
}

function str(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function bool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    if (typeof row[key] === "boolean") return row[key] as boolean;
  }
  return false;
}

/**
 * These reads go over PostgREST rather than through the generated client.
 *
 * The generated Supabase types cover 78 of the platform's tables; `tm_tasks`,
 * `security_alerts`, `usage_daily` and most of the rest of what this file
 * reads are not among them, so `supabaseAdmin.from(name)` refuses a table name
 * that is a plain string. The manager resource endpoint hit the same wall for
 * the same reason and answered it the same way, which is why this looks like
 * that: one fetch, the service key, and the table named as text.
 */
function restUrl(): string {
  return process.env["SUPABASE_URL"]?.trim() ?? "";
}

function restHeaders(): Record<string, string> {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows(
  table: string,
  select: string,
  order: string,
): Promise<Record<string, unknown>[]> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const query = `select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}&limit=${LIST_LIMIT}`;
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return (await response.json()) as Record<string, unknown>[];
}

/**
 * A count done by the database.
 *
 * `filter` is PostgREST query syntax appended as-is — "status=eq.active",
 * "read_at=is.null". Counting here rather than measuring the arrays above
 * matters because those are capped at two hundred rows, and a total taken
 * from a capped list is wrong the moment the platform grows past the cap.
 */
async function countWhere(table: string, filter = ""): Promise<number> {
  const base = restUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured");
  const response = await fetch(`${base}/rest/v1/${table}?select=id${filter ? `&${filter}` : ""}`, {
    headers: { ...restHeaders(), Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) throw new Error(`${table}: ${response.status}`);
  const range = response.headers.get("content-range") ?? "";
  const total = Number(range.slice(range.indexOf("/") + 1));
  if (!Number.isFinite(total)) throw new Error(`${table}: no count in content-range`);
  return total;
}

export async function loadAgents(degraded: Degraded): Promise<CEOAgent[]> {
  return safe(
    "ai_agents",
    degraded,
    async () => {
      const data = await rows(
        "ai_agents",
        "id,name,purpose,model_id,status,tools,runs_30d,success_rate,max_tokens,created_at",
        "created_at.desc",
      );
      return data.map((row) => ({
        id: String(row.id),
        name: str(row, "name") ?? String(row.id),
        purpose: str(row, "purpose"),
        status: str(row, "status") ?? "unknown",
        modelId: str(row, "model_id"),
        runs30d: num(row, "runs_30d"),
        successRate: num(row, "success_rate"),
        tools: Array.isArray(row.tools) ? row.tools.map(String) : [],
        maxTokens: num(row, "max_tokens"),
        createdAt: str(row, "created_at"),
      }));
    },
    [],
  );
}

export async function loadTasks(degraded: Degraded): Promise<CEOTask[]> {
  return safe(
    "tm_tasks",
    degraded,
    async () => {
      const data = await rows(
        "tm_tasks",
        "id,code,title,module,category,status,priority,assigned_to,client_name,estimated_hours,actual_minutes,sla_hours,promised_at",
        "promised_at.desc",
      );
      return data.map((row) => ({
        id: String(row.id),
        code: str(row, "code"),
        title: str(row, "title") ?? String(row.id),
        module: str(row, "module"),
        category: str(row, "category"),
        status: str(row, "status") ?? "unknown",
        priority: str(row, "priority"),
        assignedTo: str(row, "assigned_to"),
        clientName: str(row, "client_name"),
        estimatedHours: num(row, "estimated_hours"),
        actualMinutes: num(row, "actual_minutes"),
        slaHours: num(row, "sla_hours"),
        promisedAt: str(row, "promised_at"),
      }));
    },
    [],
  );
}

/**
 * Four automation tables, shown as one list.
 *
 * Each manager grew its own table and they disagree about column names —
 * `enabled` against `is_enabled`, `run_count` against `runs_count`. Rather
 * than pick one and silently drop the others, every row carries the table it
 * came from.
 */
export async function loadAutomations(degraded: Degraded): Promise<CEOAutomation[]> {
  const specs: Array<{
    table: string;
    select: string;
    order: string;
    name: string;
    trigger: string[];
    action: string[];
  }> = [
    {
      table: "automation_rules",
      select:
        "id,name,trigger_type,trigger_event,action_type,action_text,condition_text,enabled,is_enabled,run_count,runs_count,last_run_at",
      order: "last_run_at.desc",
      name: "name",
      trigger: ["trigger_type", "trigger_event"],
      action: ["action_type", "action_text"],
    },
    {
      table: "marketing_automations",
      select: "*",
      order: "created_at.desc",
      name: "name",
      trigger: ["trigger_type", "trigger", "trigger_event"],
      action: ["action_type", "action"],
    },
    {
      table: "seo_automations",
      select: "*",
      order: "created_at.desc",
      name: "name",
      trigger: ["trigger_type", "trigger", "trigger_event"],
      action: ["action_type", "action"],
    },
    {
      table: "tm_automations",
      select:
        "id,name,description,trigger_type,action_type,enabled,run_count,last_run_at,created_at",
      order: "created_at.desc",
      name: "name",
      trigger: ["trigger_type"],
      action: ["action_type"],
    },
  ];

  const lists = await Promise.all(
    specs.map((spec) =>
      safe(
        spec.table,
        degraded,
        async () => {
          const data = await rows(spec.table, spec.select, spec.order);
          return data.map((row) => ({
            id: `${spec.table}:${String(row.id)}`,
            name: str(row, spec.name) ?? String(row.id),
            description: str(row, "description") ?? str(row, "condition_text"),
            trigger: spec.trigger.map((key) => str(row, key)).find(Boolean) ?? null,
            action: spec.action.map((key) => str(row, key)).find(Boolean) ?? null,
            enabled: bool(row, "enabled", "is_enabled", "active"),
            runCount: num(row, "run_count") ?? num(row, "runs_count"),
            lastRunAt: str(row, "last_run_at"),
            source: spec.table,
          }));
        },
        [] as CEOAutomation[],
      ),
    ),
  );

  return lists.flat();
}

export async function loadNotifications(degraded: Degraded): Promise<CEONotification[]> {
  return safe(
    "notifications",
    degraded,
    async () => {
      const data = await rows(
        "notifications",
        "id,title,body,kind,read_at,created_at",
        "created_at.desc",
      );
      return data.map((row) => ({
        id: String(row.id),
        title: str(row, "title") ?? String(row.id),
        body: str(row, "body"),
        kind: str(row, "kind"),
        readAt: str(row, "read_at"),
        createdAt: str(row, "created_at"),
      }));
    },
    [],
  );
}

export async function loadUsage(degraded: Degraded): Promise<CEOUsageRow[]> {
  const finance = await safe(
    "finance_ai_api_usage",
    degraded,
    async () => {
      const data = await rows(
        "finance_ai_api_usage",
        "id,provider,service,usage_date,requests,tokens,cost",
        "usage_date.desc",
      );
      return data.map((row) => ({
        id: `finance:${String(row.id)}`,
        day: str(row, "usage_date") ?? "—",
        provider: str(row, "provider") ?? "—",
        service: str(row, "service"),
        requests: num(row, "requests"),
        tokens: num(row, "tokens"),
        costUsd: num(row, "cost"),
        source: "finance_ai_api_usage",
      }));
    },
    [] as CEOUsageRow[],
  );

  const daily = await safe(
    "usage_daily",
    degraded,
    async () => {
      const data = await rows(
        "usage_daily",
        "id,day,service_id,model_id,requests,tokens,cost_usd",
        "day.desc",
      );
      return data.map((row) => ({
        id: `daily:${String(row.id)}`,
        day: str(row, "day") ?? "—",
        provider: str(row, "service_id") ?? "—",
        service: str(row, "model_id"),
        requests: num(row, "requests"),
        tokens: num(row, "tokens"),
        costUsd: num(row, "cost_usd"),
        source: "usage_daily",
      }));
    },
    [] as CEOUsageRow[],
  );

  return [...finance, ...daily];
}

export async function loadSecurity(degraded: Degraded): Promise<CEOSecurityRow[]> {
  const alerts = await safe(
    "security_alerts",
    degraded,
    async () => {
      const data = await rows(
        "security_alerts",
        "id,detected_at,title,severity,category,status,description",
        "detected_at.desc",
      );
      return data.map((row) => ({
        id: `alert:${String(row.id)}`,
        title: str(row, "title") ?? String(row.id),
        severity: str(row, "severity") ?? "unknown",
        category: str(row, "category"),
        status: str(row, "status"),
        detectedAt: str(row, "detected_at"),
        description: str(row, "description"),
        source: "security_alerts",
      }));
    },
    [] as CEOSecurityRow[],
  );

  const findings = await safe(
    "security_findings",
    degraded,
    async () => {
      const data = await rows(
        "security_findings",
        "id,category,result,severity,title,source,confidence,created_at",
        "created_at.desc",
      );
      return data.map((row) => ({
        id: `finding:${String(row.id)}`,
        title: str(row, "title") ?? String(row.id),
        severity: str(row, "severity") ?? "unknown",
        category: str(row, "category"),
        status: str(row, "result"),
        detectedAt: str(row, "created_at"),
        description: str(row, "source"),
        source: "security_findings",
      }));
    },
    [] as CEOSecurityRow[],
  );

  return [...alerts, ...findings];
}

export async function loadInsights(degraded: Degraded): Promise<CEOInsight[]> {
  const server = await safe(
    "server_ai_insights",
    degraded,
    async () => {
      const data = await rows(
        "server_ai_insights",
        "id,insight_type,severity,title,description,recommendation,confidence,status,created_at",
        "created_at.desc",
      );
      return data.map((row) => ({
        id: `server:${String(row.id)}`,
        title: str(row, "title") ?? String(row.id),
        detail: str(row, "description"),
        recommendation: str(row, "recommendation"),
        severity: str(row, "severity") ?? "unknown",
        confidence: num(row, "confidence"),
        status: str(row, "status"),
        createdAt: str(row, "created_at"),
        source: "server_ai_insights",
      }));
    },
    [] as CEOInsight[],
  );

  const promise = await safe(
    "promise_ai_insights",
    degraded,
    async () => {
      const data = await rows(
        "promise_ai_insights",
        "id,delay_risk,miss_probability,suggested_action,escalation_advice,reason,state,generated_at",
        "generated_at.desc",
      );
      return data.map((row) => {
        const risk = str(row, "delay_risk") ?? "unknown";
        return {
          id: `promise:${String(row.id)}`,
          title: `Delivery promise at ${risk} risk`,
          detail: str(row, "reason"),
          recommendation: str(row, "suggested_action") ?? str(row, "escalation_advice"),
          severity: risk,
          // Stored 0–1 by the producer; shown as a percentage like every other
          // confidence on these screens.
          confidence: (() => {
            const p = num(row, "miss_probability");
            return p === null ? null : Math.round(p * 100);
          })(),
          status: str(row, "state"),
          createdAt: str(row, "generated_at"),
          source: "promise_ai_insights",
        };
      });
    },
    [] as CEOInsight[],
  );

  return [...server, ...promise];
}

/**
 * The tiles above the lists.
 *
 * Counted by the database rather than from the arrays above, because those are
 * capped at two hundred rows each and a total worked out from a capped list is
 * wrong the moment the platform grows past the cap.
 */
export async function loadOpsSummary(degraded: Degraded): Promise<CEOOpsSummary> {
  const [agents, agentsActive, tasks, tasksOpen, notificationsUnread, securityOpen] =
    await Promise.all([
      safe("ai_agents", degraded, () => countWhere("ai_agents"), null),
      safe("ai_agents", degraded, () => countWhere("ai_agents", "status=eq.active"), null),
      safe("tm_tasks", degraded, () => countWhere("tm_tasks"), null),
      safe(
        "tm_tasks",
        degraded,
        () => countWhere("tm_tasks", "status=not.in.(done,closed,cancelled)"),
        null,
      ),
      safe("notifications", degraded, () => countWhere("notifications", "read_at=is.null"), null),
      safe(
        "security_alerts",
        degraded,
        () => countWhere("security_alerts", "resolved_at=is.null"),
        null,
      ),
    ]);

  const automations = await loadAutomations([]);
  const usage = await loadUsage([]);
  const spend = usage.reduce<number | null>((total, row) => {
    if (row.costUsd === null) return total;
    return (total ?? 0) + row.costUsd;
  }, null);

  return {
    agents,
    agentsActive,
    tasks,
    tasksOpen,
    automations: automations.length,
    automationsEnabled: automations.filter((a) => a.enabled).length,
    notificationsUnread,
    securityOpen,
    spendUsd: spend === null ? null : Math.round(spend * 100) / 100,
  };
}

/** Everything the operational screens need, in one round trip. */
export async function loadOpsState(): Promise<CEOOpsState> {
  const degraded: Degraded = [];
  const [summary, agents, tasks, automations, notifications, usage, security, insights] =
    await Promise.all([
      loadOpsSummary(degraded),
      loadAgents(degraded),
      loadTasks(degraded),
      loadAutomations(degraded),
      loadNotifications(degraded),
      loadUsage(degraded),
      loadSecurity(degraded),
      loadInsights(degraded),
    ]);

  return {
    summary,
    agents,
    tasks,
    automations,
    notifications,
    usage,
    security,
    insights,
    sources: OPS_SOURCES,
    degraded: [...new Set(degraded)],
  };
}
