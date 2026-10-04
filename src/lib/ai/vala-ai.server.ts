/**
 * Vala AI workspace data, read from and written to the stores the platform
 * already keeps for each purpose. Server only: every function here uses the
 * service-role client, so the caller must have passed requireOperator first
 * (ai.functions.ts does that before importing this module).
 *
 * Where each screen's data lives:
 *   - Execution logs and prompt history: audit_logs, entity_type "vala_ai",
 *     one row per command with the command, the reply, its outcome and latency.
 *     Each caller reads only the commands they ran (metadata.user_id): one
 *     account's conversation is never shown to another.
 *   - Models: the AI routing pool in AI API Manager (api_services, the same
 *     active + approved chat endpoints the gateway routes to), with request
 *     counts and latency measured from usage_events.
 *   - Credits: metered spend from usage_events. No provider balance or top-up
 *     ledger is recorded anywhere, so balance and runway are reported as unknown.
 *   - Error detection: unresolved error_events, grouped by fingerprint.
 *   - Settings: system_settings, category "ai".
 *   - Lock: system_settings key "vala_ai.write_lock"; who changed it is the
 *     latest "lock_changed" row in audit_logs.
 *   - Rollback snapshots: completed server_backup_jobs.
 *   - Projects: nothing on the platform holds Vala AI projects, so the screen
 *     says so rather than listing anything.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Operator } from "@/lib/auth/require-operator.server";
import { SlidingWindowLimiter } from "@/lib/i18n/limits";

export const VALA_ENTITY = "vala_ai";
export const LOCK_KEY = "vala_ai.write_lock";

// Some of these tables are not in the generated types (server_backup_jobs), and
// the rest are read with column lists, so the client is used untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any;

export type Sourced<T> = {
  source: "postgres" | "unavailable";
  data: T;
  available: boolean;
  reason?: string;
};

function live<T>(data: T): Sourced<T> {
  return { source: "postgres", data, available: true };
}

function unavailable<T>(what: string, reason: string, data: T): Sourced<T> {
  console.error(`[vala-ai] ${what} unavailable: ${reason}`);
  return { source: "unavailable", data, available: false, reason: `${what}: ${reason}` };
}

type CommandRow = {
  id: string;
  occurred_at: string;
  actor: string;
  severity: string;
  metadata: Record<string, unknown> | null;
};

async function commandRows(
  userId: string,
  limit: number,
): Promise<{ rows: CommandRow[]; error?: string }> {
  const { data, error } = await db()
    .from("audit_logs")
    .select("id, occurred_at, actor, severity, metadata")
    .eq("entity_type", VALA_ENTITY)
    .eq("action", "command")
    .eq("metadata->>user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CommandRow[] };
}

const text = (v: unknown): string | null => (typeof v === "string" && v.length ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function readExecutionLogs(caller: Operator) {
  const { rows, error } = await commandRows(caller.userId, 500);
  if (error) return unavailable("Execution logs", error, []);
  return live(
    rows.map((row) => {
      const m = row.metadata ?? {};
      const status = text(m["status"]);
      return {
        id: row.id,
        command: text(m["command"]) ?? "",
        status: status === "error" || status === "warning" ? status : "success",
        durationMs: num(m["duration_ms"]),
        projectTitle: text(m["project"]),
        actor: row.actor,
        createdAt: row.occurred_at,
      };
    }),
  );
}

export async function readPromptHistory(caller: Operator) {
  const { rows, error } = await commandRows(caller.userId, 200);
  if (error) return unavailable("Prompt history", error, []);
  const entries: Record<string, unknown>[] = [];
  for (const row of rows) {
    const m = row.metadata ?? {};
    const reply = text(m["reply"]);
    if (reply) {
      entries.push({
        id: `${row.id}:assistant`,
        role: "assistant",
        content: reply,
        model: null,
        language: null,
        tokens: null,
        projectTitle: text(m["project"]),
        createdAt: row.occurred_at,
      });
    }
    entries.push({
      id: `${row.id}:user`,
      role: "user",
      content: text(m["command"]) ?? "",
      model: null,
      language: null,
      tokens: null,
      projectTitle: text(m["project"]),
      createdAt: row.occurred_at,
    });
  }
  return live(entries);
}

/**
 * Per-account ceiling on recorded commands. A command is recorded once per
 * /api/chat reply, which is itself limited per account, so this only bounds a
 * client writing audit rows without asking anything.
 */
const RECORD_LIMIT_PER_MINUTE = 30;
const recordLimiter = new SlidingWindowLimiter(60_000, 5_000);

export async function recordCommand(
  caller: Operator,
  input: {
    command: string;
    reply: string | null;
    status: "success" | "error" | "warning";
    durationMs: number;
    projectTitle?: string | null;
  },
) {
  if (recordLimiter.hit(caller.userId, RECORD_LIMIT_PER_MINUTE)) {
    throw new Error("Too many commands recorded in the last minute. Please wait a moment.");
  }
  const { data, error } = await db()
    .from("audit_logs")
    .insert({
      entity_type: VALA_ENTITY,
      entity_id: null,
      action: "command",
      actor: caller.email || caller.userId,
      severity:
        input.status === "error" ? "error" : input.status === "warning" ? "warning" : "info",
      metadata: {
        user_id: caller.userId,
        command: input.command,
        reply: input.reply,
        status: input.status,
        duration_ms: input.durationMs,
        project: input.projectTitle ?? null,
        route: "/api/chat",
      },
    })
    .select("id, occurred_at")
    .maybeSingle();
  if (error) throw new Error(`Execution was not recorded: ${error.message}`);
  if (!data) throw new Error("Execution was not recorded.");
  return data as { id: string; occurred_at: string };
}

/** Same rule as the gateway's resolveAiTargets: active, approved, chat endpoint. */
function inRoutingPool(row: Record<string, unknown>): boolean {
  return (
    row["status"] === "active" &&
    row["approval_status"] === "approved" &&
    /chat\/completions|\/v1\/messages/.test(String(row["endpoint_url"] ?? ""))
  );
}

export async function readModels() {
  const { data: services, error } = await db()
    .from("api_services")
    .select("id, name, provider_id, status, approval_status, endpoint_url, category")
    .in("category", ["ai", "llm"])
    .order("name");
  if (error) return unavailable("AI routing pool", error.message, []);
  const pool = ((services ?? []) as Record<string, unknown>[]).filter(inRoutingPool);
  if (pool.length === 0) return live([]);

  const providerIds = [...new Set(pool.map((s) => s["provider_id"]).filter(Boolean))] as string[];
  const [{ data: providers }, { data: models }, usage] = await Promise.all([
    providerIds.length
      ? db().from("ai_providers").select("id, name").in("id", providerIds)
      : Promise.resolve({ data: [] }),
    providerIds.length
      ? db()
          .from("ai_models")
          .select("provider_id, model_id, is_default, status")
          .in("provider_id", providerIds)
          .eq("is_default", true)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
    db()
      .from("usage_events")
      .select("service_id, requests, latency_ms")
      .in(
        "service_id",
        pool.map((s) => s["id"]),
      )
      .gte("occurred_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(20_000),
  ]);
  if (usage.error) return unavailable("AI usage", usage.error.message, []);

  const providerName = new Map(
    ((providers ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
  );
  const defaultModel = new Map(
    ((models ?? []) as { provider_id: string; model_id: string }[]).map((m) => [
      m.provider_id,
      m.model_id,
    ]),
  );
  const stats = new Map<string, { requests: number; latency: number; timed: number }>();
  for (const row of (usage.data ?? []) as {
    service_id: string;
    requests: number | null;
    latency_ms: number | null;
  }[]) {
    const s = stats.get(row.service_id) ?? { requests: 0, latency: 0, timed: 0 };
    s.requests += typeof row.requests === "number" && row.requests > 0 ? row.requests : 1;
    if (typeof row.latency_ms === "number") {
      s.latency += row.latency_ms;
      s.timed += 1;
    }
    stats.set(row.service_id, s);
  }
  const total = [...stats.values()].reduce((sum, s) => sum + s.requests, 0);

  return live(
    pool.map((service) => {
      const s = stats.get(String(service["id"]));
      const providerId = String(service["provider_id"] ?? "");
      return {
        id: String(service["id"]),
        name: String(service["name"]),
        provider: providerName.get(providerId) ?? null,
        modelId: defaultModel.get(providerId) ?? null,
        status: "active",
        requests: s?.requests ?? 0,
        latencyMs: s && s.timed ? Math.round(s.latency / s.timed) : null,
        // Share of the pool's last-30-day requests this service carried.
        load: total ? Math.round(((s?.requests ?? 0) / total) * 100) : null,
      };
    }),
  );
}

export async function readCredits() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { data, error } = await db()
    .from("usage_events")
    .select("occurred_at, cost_usd, tokens_in, tokens_out, success")
    .eq("source", "ai-gateway")
    .gte("occurred_at", monthStart.toISOString())
    .limit(50_000);
  const empty = {
    balance: null,
    runwayDays: null,
    todayUsage: 0,
    monthUsage: 0,
    unpricedToday: 0,
    unpricedMonth: 0,
    transactions: [],
    usage: [],
  };
  if (error) return unavailable("AI usage", error.message, empty);

  let todayUsage = 0;
  let monthUsage = 0;
  let unpricedToday = 0;
  let unpricedMonth = 0;
  for (const row of (data ?? []) as {
    occurred_at: string;
    cost_usd: number | null;
    tokens_in: number | null;
    tokens_out: number | null;
    success: boolean | null;
  }[]) {
    const today = new Date(row.occurred_at) >= dayStart;
    // A call the provider reported no token usage for (streamed replies are
    // metered without it) has no known cost; it is counted, not priced at 0.
    const priced = (row.tokens_in ?? 0) + (row.tokens_out ?? 0) > 0 && row.cost_usd !== null;
    if (priced) {
      monthUsage += Number(row.cost_usd);
      if (today) todayUsage += Number(row.cost_usd);
    } else if (row.success !== false) {
      // A refused call (bad request, no credit) produced nothing to bill.
      unpricedMonth += 1;
      if (today) unpricedToday += 1;
    }
  }
  return {
    ...live({ ...empty, todayUsage, monthUsage, unpricedToday, unpricedMonth }),
    reason:
      "Provider balances and top-ups are not recorded on this platform, so balance and runway are unknown.",
  };
}

export async function readIssues() {
  const [{ data, error }, resolved] = await Promise.all([
    db()
      .from("error_events")
      .select("fingerprint, message, source, severity, route, fn_name, occurred_at")
      .eq("resolved", false)
      .order("occurred_at", { ascending: false })
      .limit(2000),
    db().from("error_events").select("id", { count: "exact", head: true }).eq("resolved", true),
  ]);
  if (error) return unavailable("Error events", error.message, []);
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      category: string;
      severity: string;
      count: number;
      detail: string | null;
      lastSeen: string;
    }
  >();
  for (const row of (data ?? []) as Record<string, string | null>[]) {
    const key = String(row["fingerprint"]);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (row["severity"] === "critical") existing.severity = "critical";
      continue;
    }
    groups.set(key, {
      id: key,
      label: String(row["message"] ?? "").slice(0, 160),
      category: row["route"] ?? row["source"] ?? "",
      severity: row["severity"] === "critical" ? "critical" : "warning",
      count: 1,
      detail: [row["route"], row["fn_name"]].filter(Boolean).join(" · ") || null,
      lastSeen: String(row["occurred_at"]),
    });
  }
  return {
    ...live([...groups.values()].sort((a, b) => b.count - a.count)),
    resolved: resolved.count ?? null,
  };
}

export async function readSettings() {
  const { data, error } = await db()
    .from("system_settings")
    .select("id, key, label, value, value_type, description, updated_at")
    .eq("category", "ai")
    .neq("key", LOCK_KEY)
    .order("key");
  if (error) return unavailable("System settings", error.message, []);
  return live(data ?? []);
}

export async function readSnapshots() {
  const { data, error } = await db()
    .from("server_backup_jobs")
    .select("id, job_name, backup_type, storage_location, size_gb, status, last_run_at, created_at")
    .eq("status", "completed")
    .order("last_run_at", { ascending: false })
    .limit(200);
  if (error) return unavailable("Server backups", error.message, []);
  return live(
    ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row["id"]),
      label: String(row["job_name"] ?? row["backup_type"] ?? "Backup"),
      projectTitle: (row["storage_location"] as string | null) ?? null,
      sizeKb:
        typeof row["size_gb"] === "number"
          ? Math.round(Number(row["size_gb"]) * 1024 * 1024)
          : null,
      createdAt: String(row["last_run_at"] ?? row["created_at"]),
    })),
  );
}

export async function readLock() {
  const [{ data, error }, change] = await Promise.all([
    db()
      .from("system_settings")
      .select("value, description, updated_at")
      .eq("key", LOCK_KEY)
      .maybeSingle(),
    db()
      .from("audit_logs")
      .select("actor, occurred_at")
      .eq("entity_type", VALA_ENTITY)
      .eq("action", "lock_changed")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) {
    // Fails closed: when its state cannot be read, the lock reads as armed.
    return unavailable("Lock state", error.message, {
      locked: true,
      reason: "Lock state could not be read, so it stays armed.",
      changedBy: null,
      updatedAt: null,
    });
  }
  if (!data) {
    return live({
      locked: true,
      reason: "The lock has never been changed; it is armed by default.",
      changedBy: null,
      updatedAt: null,
    });
  }
  const row = data as { value: string; description: string | null; updated_at: string };
  return live({
    locked: row.value !== "false",
    reason: row.description,
    changedBy: (change.data as { actor?: string } | null)?.actor ?? null,
    updatedAt: row.updated_at,
  });
}

export async function writeLock(caller: Operator, locked: boolean, reason?: string) {
  const updatedAt = new Date().toISOString();
  const description = reason?.trim() || (locked ? "Write lock armed" : "Write lock disabled");
  const { error } = await db()
    .from("system_settings")
    .upsert(
      {
        key: LOCK_KEY,
        label: "Vala AI write lock",
        category: "ai",
        value_type: "boolean",
        value: String(locked),
        description,
        updated_at: updatedAt,
      },
      { onConflict: "key" },
    );
  if (error) throw new Error(`Lock state was not changed: ${error.message}`);
  const actor = caller.email || caller.userId;
  const { error: auditError } = await db()
    .from("audit_logs")
    .insert({
      entity_type: VALA_ENTITY,
      entity_id: LOCK_KEY,
      action: "lock_changed",
      actor,
      severity: "warning",
      metadata: { user_id: caller.userId, locked, reason: description },
    });
  if (auditError)
    throw new Error(`Lock changed, but the change was not audited: ${auditError.message}`);
  return live({ locked, reason: description, changedBy: actor, updatedAt });
}
