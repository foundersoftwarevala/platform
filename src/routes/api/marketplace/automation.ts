import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";
import { describeCron, nextRun, parseCron, previousRun } from "@/lib/marketplace/cron";

/**
 * The Automation Engine console.
 *
 * The screen this replaces showed four empty counters over ten feature chips.
 * The important thing found while connecting it is that this platform already
 * has a real scheduler and real jobs, and also has a set of automation rows that
 * look like automation and are not.
 *
 * What is real: four cron entries on the host, running every five minutes,
 * every fifteen minutes and once a night. They are not asserted here - each one
 * is proved by the rows it writes, so "the scheduler is alive" is a reading
 * taken from the database rather than a claim. If telemetry stops writing, this
 * screen says MISSED with the age of the last row, which is section 42.
 *
 * What is not real: seo_automations, automation_rules and marketing_automations
 * carry run counts, success rates and next_run_at values, and nothing executes
 * any of them. Their last activity is weeks old and their next run is in the
 * past. Section 1 says metrics must come from real records, so these are listed
 * as definitions with no runner rather than counted as automation, and the
 * screen says so in as many words.
 *
 * Run Now is real where a real thing exists to run. The sweeps are idempotent
 * SECURITY DEFINER functions the cron already calls; running one from here
 * calls the same function and reports what it returned. Nothing else is
 * offered, because there is no worker and no job table to enqueue into, and
 * section 33 is explicit that completed must not be shown before a worker has
 * actually completed.
 */

function url(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rows<T = Record<string, unknown>>(path: string): Promise<T[]> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, { headers: admin() });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } catch {
    return [];
  }
}

async function count(path: string): Promise<number> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return 0;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ jobs */

/** Section 7's statuses. Every source maps onto exactly these. */
type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "BLOCKED" | "CANCELLED";

type Job = {
  job_id: string;
  automation: string;
  source: string;
  trigger: string;
  target: string | null;
  status: JobStatus;
  attempt: number;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
  summary: string | null;
};

const STATUS: Record<string, JobStatus> = {
  succeeded: "COMPLETED", success: "COMPLETED", completed: "COMPLETED", done: "COMPLETED",
  running: "RUNNING", in_progress: "RUNNING",
  queued: "QUEUED", pending: "QUEUED",
  partial: "PARTIAL",
  failed: "FAILED", error: "FAILED",
  blocked: "BLOCKED", not_configured: "BLOCKED",
  cancelled: "CANCELLED", canceled: "CANCELLED",
};

function normaliseStatus(value: unknown): JobStatus {
  const key = String(value ?? "").toLowerCase();
  return STATUS[key] ?? (key ? "FAILED" : "QUEUED");
}

function ms(from: unknown, to: unknown): number | null {
  if (!from || !to) return null;
  const a = Date.parse(String(from));
  const b = Date.parse(String(to));
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) : null;
}

/**
 * Every job table that holds real executions.
 *
 * These are the ones earlier parts of this work created and that have actually
 * run. Nothing is invented to fill the list out: a source with no rows shows as
 * a source with no rows.
 */
const JOB_SOURCES = [
  {
    key: "demo_sandbox_jobs", label: "Demo sandbox", trigger: "manual",
    select: "id,operation,status,attempt,started_at,finished_at,error_category,error_detail,sandbox_id",
    order: "started_at",
  },
  {
    key: "demo_provision_jobs", label: "Demo provisioning", trigger: "manual",
    select: "id,operation,status,attempt,created_at,finished_at,error_category,error_detail,demo_id",
    order: "created_at",
  },
  {
    key: "demo_sandbox_cleanup_jobs", label: "Sandbox cleanup", trigger: "scheduled",
    select: "id,scope,status,started_at,finished_at,error_detail,sandbox_id",
    order: "started_at",
  },
  {
    key: "brand_enforcement_runs", label: "Brand enforcement", trigger: "manual",
    select: "id,scope,policy_state,started_at,completed_at,scanned,flagged,failed",
    order: "started_at",
  },
  {
    key: "ai_content_generations", label: "AI content generation", trigger: "manual",
    select: "id,api_kind,status,error_code,error_detail,created_at,finished_at,cost_usd",
    order: "created_at",
  },
  {
    key: "seo_automation_runs", label: "SEO automation run", trigger: "scheduled",
    select: "id,automation_id,status,started_at,finished_at,items_processed,message",
    order: "started_at",
  },
] as const;

/**
 * Sources whose rows are seeded rather than executed.
 *
 * seo_automation_runs holds 56 rows from one afternoon three weeks ago, every
 * message templated as "Completed run for X" including on the rows marked
 * failed, and no process writes it. Counting it would put a fabricated average
 * duration and success rate at the top of the screen, which is exactly what
 * section 1 forbids. The rows are still shown - as history with nothing behind
 * it - and they are not counted.
 */
const SEEDED_SOURCES = new Set<string>(["seo_automation_runs"]);

async function collectJobs(): Promise<Job[]> {
  const all = await Promise.all(
    JOB_SOURCES.map(async (source) => {
      const list = await rows(
        `${source.key}?select=${source.select}&order=${source.order}.desc&limit=40`,
      );
      return list.map((r): Job => {
        const started = r.started_at ?? r.created_at ?? null;
        const finished = r.finished_at ?? r.completed_at ?? null;
        const status =
          source.key === "brand_enforcement_runs"
            ? finished ? "COMPLETED" : "RUNNING"
            : normaliseStatus(r.status);
        const error =
          (r.error_detail as string | null) ??
          (r.error_category as string | null) ??
          (r.error_code as string | null) ??
          null;
        return {
          job_id: String(r.id),
          automation: source.label,
          source: source.key,
          trigger: source.trigger,
          target: (r.sandbox_id ?? r.demo_id ?? r.automation_id ?? r.scope ?? null) as string | null,
          status: status as JobStatus,
          attempt: Number(r.attempt ?? 1),
          created_at: (r.created_at ?? null) as string | null,
          started_at: started as string | null,
          finished_at: finished as string | null,
          duration_ms: ms(started, finished),
          error,
          summary:
            (r.message as string | null) ??
            (r.operation as string | null) ??
            (r.scanned !== undefined ? `${r.scanned} scanned, ${r.flagged} flagged` : null),
        };
      });
    }),
  );
  return all
    .flat()
    .sort((a, b) => Date.parse(b.started_at ?? "0") - Date.parse(a.started_at ?? "0"));
}

/* ------------------------------------------------------------- scheduler */

/**
 * The scheduler, proved rather than described.
 *
 * Each entry names the table its run writes to, and the freshness of the newest
 * row is the health. A job whose evidence is older than its cadence allows is
 * MISSED, with the age, which is section 42 without a second bookkeeping table
 * that could itself drift.
 */
const SCHEDULED = [
  {
    id: "sv-telemetry", name: "Server telemetry", cron: "*/5 * * * *", everyMinutes: 5,
    what: "Reads load, memory, disk, network and response time off this machine and appends a row.",
    evidence: "server_metrics_history", column: "recorded_at",
  },
  {
    id: "sv-demo-monitor", name: "Demo health monitor", cron: "*/15 * * * *", everyMinutes: 15,
    what: "Checks every active demo URL, writes the result and raises or clears alerts.",
    evidence: "demo_health", column: "checked_at",
  },
  {
    id: "sv-seo-crawl", name: "SEO site crawl", cron: "17 3 * * *", everyMinutes: 1440,
    what: "Crawls our own pages, records what is on each one and resolves issues it no longer finds.",
    evidence: "seo_pages", column: "last_crawled_at",
  },
  {
    id: "sv-sweeps", name: "SLA and deadline sweeps", cron: "*/5 * * * *", everyMinutes: 5,
    what: "Calls tm_sla_sweep, pt_sweep and ams_sweep. Idempotent by construction.",
    // These write nothing on a clean pass by design, so there is no freshness
    // reading to take. Saying that is more useful than inventing one.
    evidence: null, column: null,
  },
] as const;

async function schedulerHealth() {
  return Promise.all(
    SCHEDULED.map(async (task) => {
      // Section 6: the expression is validated here, not taken on trust, and
      // the times it implies are computed rather than described.
      const cron = parseCron(task.cron);
      const expectedLast = previousRun(task.cron);
      const expectedNext = nextRun(task.cron);
      const timing = {
        cron_valid: cron.ok,
        cron_error: cron.ok ? null : cron.error,
        cron_description: describeCron(task.cron),
        timezone: "UTC",
        expected_last_run: expectedLast ? expectedLast.toISOString() : null,
        next_run: expectedNext ? expectedNext.toISOString() : null,
      };

      if (!task.evidence || !task.column) {
        return {
          ...task,
          ...timing,
          last_seen: null,
          age_minutes: null,
          state: "NO_SIGNAL",
          note: "This one writes nothing when it passes cleanly, so there is no row to read its health from. A failure is logged; a success is silent.",
        };
      }
      const latest = await rows(
        `${task.evidence}?select=${task.column}&order=${task.column}.desc&limit=1`,
      );
      const seen = latest[0]?.[task.column] as string | undefined;
      if (!seen) {
        return {
          ...task, ...timing, last_seen: null, age_minutes: null,
          state: "NEVER_RAN", note: `${task.evidence} has no rows.`,
        };
      }
      const age = Math.round((Date.now() - Date.parse(seen)) / 60000);

      // Section 42, with an actual expected time. One cadence of grace, so a
      // pass that is still running is not called missed a second after it was
      // due.
      const dueBy = expectedLast
        ? expectedLast.getTime() - task.everyMinutes * 60000
        : null;
      const state = dueBy !== null && Date.parse(seen) < dueBy ? "MISSED" : "HEALTHY";
      return {
        ...task,
        ...timing,
        last_seen: seen,
        age_minutes: age,
        state,
        note:
          state === "MISSED"
            ? `It should have run at ${expectedLast?.toISOString().slice(11, 16)} UTC. The newest row in ${task.evidence} is ${age} minutes old.`
            : `Newest row in ${task.evidence} is ${age} minute(s) old. Next due ${expectedNext?.toISOString().slice(11, 16)} UTC.`,
      };
    }),
  );
}

/* ----------------------------------------------------------- definitions */

/**
 * Automation rows that exist in the database, and whether anything runs them.
 *
 * live is not a guess: a definition is live only when a real job table or the
 * host scheduler can be shown to execute it. Everything else is a row that
 * describes an automation nobody wired up, and it is labelled that way rather
 * than counted in the metrics at the top of the screen.
 */
async function definitions() {
  const [rules, seo, marketing, leads, flows] = await Promise.all([
    rows("automation_rules?select=id,name,scope,action_type,is_enabled,last_run_at,runs_count&order=name"),
    rows("seo_automations?select=id,name,automation_type,status,schedule,last_run_at,next_run_at,runs_count,success_rate"),
    rows("marketing_automations?select=id,name,channel,status,trigger_type,last_run_at,runs,is_seed"),
    rows("lead_automation_rules?select=id,name,rule_key,trigger_event,is_active,last_executed_at,execution_count"),
    rows("seo_automation_flows?select=id,name,status,trigger_event,executions"),
  ]);

  const stale = (value: unknown): number | null => {
    if (!value) return null;
    return Math.round((Date.now() - Date.parse(String(value))) / 86400000);
  };

  const map = (
    list: Record<string, unknown>[],
    table: string,
    fields: { name: string; enabled: string; last: string; runs: string; type: string },
  ) =>
    list.map((r) => ({
      id: String(r.id),
      table,
      name: String(r[fields.name] ?? "Unnamed"),
      type: String(r[fields.type] ?? ""),
      enabled: Boolean(r[fields.enabled] ?? r.status === "active"),
      last_run_at: (r[fields.last] ?? null) as string | null,
      days_since_run: stale(r[fields.last]),
      runs: Number(r[fields.runs] ?? 0),
      seeded: r.is_seed === true,
      // seo_automation_runs is the only one of these with a run table, and its
      // newest run is as old as the definitions themselves.
      has_runner: false,
    }));

  return [
    ...map(rules, "automation_rules", { name: "name", enabled: "is_enabled", last: "last_run_at", runs: "runs_count", type: "action_type" }),
    ...map(seo, "seo_automations", { name: "name", enabled: "status", last: "last_run_at", runs: "runs_count", type: "automation_type" }),
    ...map(marketing, "marketing_automations", { name: "name", enabled: "status", last: "last_run_at", runs: "runs", type: "channel" }),
    ...map(leads, "lead_automation_rules", { name: "name", enabled: "is_active", last: "last_executed_at", runs: "execution_count", type: "trigger_event" }),
    ...map(flows, "seo_automation_flows", { name: "name", enabled: "status", last: "created_at", runs: "executions", type: "trigger_event" }),
  ];
}

/* -------------------------------------------------------------------- AI */

/**
 * Section 23 and 24: what each AI automation would route to, and whether it can
 * run at all. Whether a credential exists is answered here on the server and
 * reported as a boolean - the value never leaves this process (section 47).
 */
async function aiState() {
  const [providers, models, usage, recent] = await Promise.all([
    rows("ai_providers?select=id,slug,name,status,api_kind,credential_env,content_generation_enabled&order=slug"),
    rows("ai_models?select=id,name,model_id,modality,is_default,input_cost_per_1k,output_cost_per_1k,provider_id&order=name"),
    rows("ai_content_usage?select=*&order=usage_date.desc&limit=30"),
    rows("ai_content_generations?select=id,api_kind,status,error_code,created_at,finished_at,cost_usd&order=created_at.desc&limit=10"),
  ]);

  const configured = providers.map((p) => {
    const env = p.credential_env ? String(p.credential_env) : null;
    return {
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
      status: String(p.status),
      api_kind: (p.api_kind ?? null) as string | null,
      generation_enabled: Boolean(p.content_generation_enabled),
      credential_env: env,
      // The name of the variable, never its value.
      credential_present: env ? Boolean(process.env[env]?.trim()) : false,
    };
  });

  // Section 25: the routing table, expressed as what each task needs rather
  // than as a provider name burned into each automation.
  const routing = [
    { task: "Auto SEO", modality: "text", prefers: "a fast, cheap text model" },
    { task: "Auto Tags", modality: "text", prefers: "the cheapest text model" },
    { task: "Auto Documentation", modality: "text", prefers: "the most capable writing model" },
    { task: "Auto Blog", modality: "text", prefers: "the most capable writing model" },
    { task: "Auto Translation", modality: "translate", prefers: "the configured translation provider" },
    { task: "Auto Thumbnail", modality: "image", prefers: "an image generation model" },
  ].map((route) => {
    // Translation has a provider of its own on this platform rather than a
    // text model - section 25 asks for the configured translation provider,
    // and /api/marketplace/translate is it.
    if (route.modality === "translate") {
      const endpoint = process.env.TRANSLATE_PROVIDER_URL?.trim();
      return {
        ...route,
        model: endpoint ? "Configured translation provider" : null,
        model_id: null,
        provider: "translate-provider",
        input_cost_per_1k: null,
        runnable: Boolean(endpoint),
        blocked_by: endpoint ? null : "TRANSLATE_PROVIDER_URL is not set.",
      };
    }
    const candidates = models.filter((m) => String(m.modality) === route.modality);
    const chosen = candidates.find((m) => m.is_default) ?? candidates[0] ?? null;
    // Joined on provider_id. Matching a model id against a provider slug was
    // wrong: claude-3-5-sonnet-latest does not begin with "anthropic", so every
    // text task reported an unknown provider.
    const provider = chosen
      ? configured.find((p) => p.id === String(chosen.provider_id))
      : undefined;
    return {
      ...route,
      model: chosen ? String(chosen.name) : null,
      model_id: chosen ? String(chosen.model_id) : null,
      provider: provider?.slug ?? null,
      input_cost_per_1k: chosen ? Number(chosen.input_cost_per_1k ?? 0) : null,
      runnable: Boolean(provider?.credential_present),
      blocked_by: provider?.credential_present
        ? null
        : provider
          ? `${provider.name} has no credential in this environment (${provider.credential_env ?? "none named"}).`
          : "No provider is registered for this model.",
    };
  });

  const stuck = recent.filter(
    (r) => String(r.status) === "RUNNING" && !r.finished_at &&
      Date.now() - Date.parse(String(r.created_at)) > 30 * 60000,
  );

  return {
    providers: configured,
    models: models.map((m) => ({
      name: String(m.name), model_id: String(m.model_id), modality: String(m.modality),
      is_default: Boolean(m.is_default),
      input_cost_per_1k: Number(m.input_cost_per_1k ?? 0),
      output_cost_per_1k: Number(m.output_cost_per_1k ?? 0),
    })),
    routing,
    usage,
    recent,
    // Section 36 and 37: a job that started and never ended is not quietly
    // dropped. It is named, with how long it has been that way.
    stuck: stuck.map((r) => ({
      id: String(r.id),
      minutes: Math.round((Date.now() - Date.parse(String(r.created_at))) / 60000),
    })),
  };
}

/* --------------------------------------------------------------- Run Now */

/**
 * The only things Run Now will run.
 *
 * Each is a real function the scheduler already calls, granted to the service
 * role, and idempotent - so running one by hand does what the next scheduled
 * pass would have done, and running it twice is not a second event. Anything
 * outside this list is refused with the reason, rather than given a spinner
 * that resolves to a success nobody executed.
 */
const RUNNABLE: Record<string, { label: string; rpc: string; what: string }> = {
  sandbox_cleanup: {
    label: "Sandbox cleanup", rpc: "mm_sandbox_cleanup_run",
    what: "Releases expired sandbox sessions and marks their rows cleaned.",
  },
  sandbox_expiry: {
    label: "Sandbox expiry", rpc: "mm_sandbox_expiry_run",
    what: "Expires sandboxes whose time is up.",
  },
  demo_expiry: {
    label: "Demo expiry", rpc: "mm_demo_expiry_run",
    what: "Expires demos past their end date.",
  },
  approval_sla: {
    label: "Approval SLA sweep", rpc: "mm_approval_sla_run",
    what: "Flags submissions that have passed their approval SLA.",
  },
};

async function auditRun(request: Request, action: string, after: unknown, reason: string) {
  try {
    const authorization = request.headers.get("authorization");
    const anon =
      process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? "";
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const asOperator = Boolean(authorization && anon);
    await fetch(`${url()}/rest/v1/rpc/mm_audit`, {
      method: "POST",
      headers: asOperator
        ? { apikey: anon, Authorization: authorization!, "Content-Type": "application/json" }
        : { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_action: action, p_entity_type: "automation", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[automation] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/automation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const wantsCsv = new URL(request.url).searchParams.get("format") === "csv";
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("automation_view")) {
          await recordDenial(request, {
            action: "automation_view", permission: "marketplace.automation.view",
            roles: caller.roles, entityType: "automation", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.automation.view is required." },
            { status: 403 },
          );
        }

        // Section 19: an automation health report, from the same rows the
        // screen counts. Export permission, not merely being an operator.
        if (wantsCsv) {
          const exporter = resolveAction({
            roles: caller.roles, action: "export", permissions: matrix,
          });
          if (!exporter.visible || !exporter.enabled) {
            await recordDenial(request, {
              action: "automation_report", permission: "marketplace.export",
              roles: caller.roles, entityType: "automation", recordId: null,
              why: `${exporter.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
            });
            return Response.json(
              { ok: false, reason: "permission_denied", message: exporter.reason },
              { status: 403 },
            );
          }
          const [reportJobs, reportSchedule] = await Promise.all([collectJobs(), schedulerHealth()]);
          const cell = (v: unknown) => {
            const text = v === null || v === undefined ? "" : String(v);
            return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          };
          const lines: string[] = [];
          lines.push("section,name,state,detail,at");
          for (const t of reportSchedule) {
            lines.push([
              "schedule", cell(t.name), cell(t.state), cell(t.note), cell(t.last_seen),
            ].join(","));
          }
          for (const j of reportJobs) {
            lines.push([
              "job", cell(j.automation), cell(j.status),
              cell(j.error ?? j.summary ?? ""), cell(j.started_at),
            ].join(","));
          }
          await auditRun(request, "Automation health report exported",
            { rows: lines.length - 1, jobs: reportJobs.length, schedules: reportSchedule.length },
            "Automation health exported as CSV from the Marketplace Manager.");
          return new Response(lines.join("\n"), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="automation-health-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
          });
        }

        const [jobs, scheduler, defs, ai, backupJobs, backupSchedules] = await Promise.all([
          collectJobs(),
          schedulerHealth(),
          definitions(),
          aiState(),
          count("server_backup_jobs?select=id"),
          count("server_backup_schedules?select=id"),
        ]);

        // Only executions. Seeded history is separated out before anything
        // is counted, so no figure on this screen comes from a row nobody ran.
        const executed = jobs.filter((j) => !SEEDED_SOURCES.has(j.source));
        const seeded = jobs.filter((j) => SEEDED_SOURCES.has(j.source));
        const done = executed.filter((j) => j.status === "COMPLETED");
        const durations = executed
          .map((j) => j.duration_ms)
          .filter((d): d is number => d !== null && d > 0);
        const lastSuccess = done[0]?.finished_at ?? null;

        return Response.json({
          ok: true,
          // Section 1: every one of these is a count of rows that exist.
          metrics: {
            total: executed.length,
            running: executed.filter((j) => j.status === "RUNNING").length,
            queued: executed.filter((j) => j.status === "QUEUED").length,
            failed: executed.filter((j) => j.status === "FAILED" || j.status === "BLOCKED").length,
            completed: done.length,
            partial: executed.filter((j) => j.status === "PARTIAL").length,
            success_rate: executed.length
              ? Math.round((done.length / executed.length) * 1000) / 10
              : null,
            average_duration_ms: durations.length
              ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
              : null,
            last_successful_run: lastSuccess,
            counted_from: JOB_SOURCES.filter((s) => !SEEDED_SOURCES.has(s.key)).map((s) => s.key),
            excluded: {
              sources: [...SEEDED_SOURCES],
              rows: seeded.length,
              why: "Seeded rows. They were never executed, so counting them would put a made-up success rate and average duration at the top of this screen.",
            },
          },
          seeded_history: seeded.slice(0, 20),
          scheduler,
          jobs: jobs.slice(0, 60),
          definitions: defs,
          ai,
          backups: {
            jobs: backupJobs,
            schedules: backupSchedules,
            // Section 20 says do not build a conflicting second backup engine.
            // The tables are here; nothing has ever written one, and no cron
            // entry calls anything that would.
            state: backupJobs === 0 && backupSchedules === 0 ? "NEVER_RUN" : "PRESENT",
            note:
              backupJobs === 0 && backupSchedules === 0
                ? "server_backup_jobs and server_backup_schedules exist and are empty, and nothing on the host schedule writes them. There has never been a backup. Restore is therefore not offered: a restore button over zero backups is the most dangerous kind of decoration."
                : "Backup records exist.",
          },
          runnable: Object.entries(RUNNABLE).map(([id, r]) => ({ id, label: r.label, what: r.what })),
          permissions: {
            view: true,
            run: may("automation_run"),
            manage: may("automation_manage"),
            restore: may("backup_restore"),
          },
          caller: { roles: caller.roles },
        });
      },

      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { action?: string; id?: string; preview?: boolean; reason?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "automation_run", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "automation_run", permission: "marketplace.automation.run",
            roles: caller.roles, entityType: "automation", recordId: body.id ?? null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            {
              ok: false, reason: "permission_denied", message: decision.reason,
              visibility: decision.visible ? "disabled" : "hidden",
            },
            { status: 403 },
          );
        }

        const id = String(body.id ?? "");
        const spec = RUNNABLE[id];
        if (!spec) {
          return Response.json(
            {
              ok: false,
              reason: "no_runner",
              message:
                `There is nothing that runs "${id}". Only the sweeps the host scheduler already calls can be run by hand; everything else would need a worker and a job queue, and neither exists here.`,
              runnable: Object.keys(RUNNABLE),
            },
            { status: 400 },
          );
        }

        // Section 51: preview changes nothing and says so.
        if (body.preview) {
          return Response.json({
            ok: true, preview: true, id, label: spec.label,
            what: spec.what,
            message: "Nothing has been run. Send preview: false to run it.",
          });
        }

        const started = Date.now();
        const response = await fetch(`${url()}/rest/v1/rpc/${spec.rpc}`, {
          method: "POST", headers: admin(), body: "{}",
        });
        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text.slice(0, 400);
        }
        const duration = Date.now() - started;

        if (!response.ok) {
          await auditRun(request, `Automation run failed: ${spec.label}`,
            { id, rpc: spec.rpc, status: response.status, duration_ms: duration, error: payload },
            `Run Now on ${spec.label} from the Marketplace Manager returned HTTP ${response.status}.`);
          return Response.json(
            {
              ok: false, reason: "run_failed", id, label: spec.label,
              status: response.status, duration_ms: duration, error: payload,
              message: `${spec.label} did not complete. Nothing is being reported as done.`,
            },
            { status: 502 },
          );
        }

        await auditRun(request, `Automation run: ${spec.label}`,
          { id, rpc: spec.rpc, duration_ms: duration, result: payload },
          String(body.reason ?? "").slice(0, 300) ||
            `${spec.label} run by hand from the Marketplace Manager.`);

        return Response.json({
          ok: true, id, label: spec.label, duration_ms: duration, result: payload,
          // Reported only because the function returned; the worker here is the
          // database function itself and it has finished by the time this line
          // is reached - section 33.
          completed: true,
        });
      },
    },
  },
});
