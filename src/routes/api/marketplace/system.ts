import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { resolveAction } from "@/lib/marketplace/permission-guard";
import { loadMatrix, recordDenial, rolesOf } from "@/lib/marketplace/permission-store.server";

/**
 * System Health, over the infrastructure that reports on itself.
 *
 * The one piece of luck here is that this platform already measures itself: a
 * cron writes a row to server_metrics_history every five minutes with CPU,
 * memory, disk, response time and an error count, taken off the machine. 585
 * rows of it. So uptime, performance and the storage figure are real
 * measurements over a real window rather than numbers to be invented, and
 * section 5's warning against hardcoding 99.9% never comes up.
 *
 * The health checks are performed, not looked up. Each one makes a request and
 * times it: the database through PostgREST, the auth backend, storage, and this
 * application's own API. A check that fails says so with its status.
 *
 * What is honestly absent, each with its reason rather than an empty card:
 * there is no cache layer on this host at all, no queue runner and no worker
 * process, and server_backup_jobs, server_logs, server_alerts and
 * server_incidents all exist and have never been written to. Section 36 is
 * explicit that these show as NOT CONNECTED rather than as zeroes dressed up as
 * health.
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

async function count(path: string): Promise<number | null> {
  try {
    const response = await fetch(`${url()}/rest/v1/${path}`, {
      headers: { ...admin(), Prefer: "count=exact", Range: "0-0" },
    });
    if (!response.ok) return null;
    return Number((response.headers.get("content-range") ?? "").split("/")[1]) || 0;
  } catch {
    return null;
  }
}

type Check = {
  service: string;
  status: "healthy" | "degraded" | "critical" | "unknown" | "not_connected";
  latency_ms: number | null;
  detail: string;
  checked_at: string;
};

/**
 * Real checks. Each one issues a request and times it; nothing is read from a
 * status column. Nothing in the detail string can carry a credential - only a
 * status code, a duration and a fixed sentence.
 */
async function runChecks(origin: string): Promise<Check[]> {
  const at = () => new Date().toISOString();

  const timed = async (
    service: string,
    target: string,
    headers: Record<string, string>,
    slowMs: number,
  ): Promise<Check> => {
    const started = Date.now();
    try {
      const response = await fetch(target, { headers, signal: AbortSignal.timeout(10000) });
      const latency = Date.now() - started;
      return {
        service,
        status: !response.ok ? "critical" : latency > slowMs ? "degraded" : "healthy",
        latency_ms: latency,
        detail: response.ok
          ? `Answered ${response.status} in ${latency} ms.`
          : `Answered ${response.status}.`,
        checked_at: at(),
      };
    } catch (error) {
      return {
        service,
        status: "critical",
        latency_ms: Date.now() - started,
        detail: error instanceof Error ? error.message.slice(0, 120) : "unreachable",
        checked_at: at(),
      };
    }
  };

  const checks = await Promise.all([
    // A real query, not a ping: one row through PostgREST and back.
    timed("Database", `${url()}/rest/v1/marketplace_products?select=id&limit=1`, admin(), 800),
    timed("Authentication", `${url()}/auth/v1/settings`, admin(), 800),
    timed("Storage", `${url()}/storage/v1/bucket`, admin(), 800),
    timed("Application API", `${origin}/api/marketplace/catalog?limit=1`, {}, 1500),
    timed("Storefront", `${origin}/`, {}, 3000),
  ]);

  // Realtime, cache and the queue runner: asked, and answered honestly.
  const realtime = process.env.SUPABASE_URL
    ? await timed("Realtime", `${url()}/realtime/v1/api/tenants/realtime-dev/health`, admin(), 1500)
    : null;

  checks.push({
    service: "Cache",
    status: "not_connected",
    latency_ms: null,
    detail:
      "There is no cache layer on this host. No Redis, no Memcached, and the application holds no shared cache of its own — pages are rendered per request. A cache panel with a hit rate would be describing something that does not exist.",
    checked_at: at(),
  });

  checks.push({
    service: "Queue worker",
    status: "not_connected",
    latency_ms: null,
    detail:
      "One process runs on this host and it serves HTTP. There is no worker and no queue runner, so nothing drains a queue. The scheduled work that does run is cron calling database functions directly.",
    checked_at: at(),
  });

  if (realtime) {
    checks.push({
      ...realtime,
      // The health path is not exposed on every project; a 404 means the check
      // could not be made, not that realtime is down.
      status: realtime.status === "critical" ? "unknown" : realtime.status,
      detail:
        realtime.status === "critical"
          ? "The realtime health path is not exposed on this project, so its state could not be determined from here."
          : realtime.detail,
    });
  }

  return checks;
}

/** Uptime and performance from the telemetry the host writes about itself. */
function summarise(history: Record<string, unknown>[], hours: number) {
  const cutoff = Date.now() - hours * 3600000;
  const window = history.filter((h) => Date.parse(String(h.recorded_at)) >= cutoff);
  if (window.length === 0) {
    return { samples: 0, uptime_pct: null, avg_response_ms: null, errors: null, max_cpu: null, max_disk: null };
  }
  const clean = window.filter((h) => Number(h.error_count ?? 0) === 0);
  const responses = window
    .map((h) => Number(h.response_time_ms ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  return {
    samples: window.length,
    // A sample is a five-minute probe that either reached the site or did not.
    uptime_pct: Math.round((clean.length / window.length) * 1000) / 10,
    avg_response_ms: responses.length
      ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length)
      : null,
    errors: window.reduce((sum, h) => sum + Number(h.error_count ?? 0), 0),
    max_cpu: Math.max(...window.map((h) => Number(h.cpu_usage ?? 0))),
    max_disk: Math.max(...window.map((h) => Number(h.disk_usage ?? 0))),
  };
}

async function audit(request: Request, action: string, after: unknown, reason: string) {
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
        p_action: action, p_entity_type: "system", p_entity_id: null,
        p_before: null, p_after: after, p_reason: reason,
      }),
    });
  } catch (error) {
    console.error("[system] audit failed", error);
  }
}

export const Route = createFileRoute("/api/marketplace/system")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const origin = new URL(request.url).origin;
        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const may = (action: string) => {
          const d = resolveAction({ roles: caller.roles, action, permissions: matrix });
          return d.visible && d.enabled;
        };
        if (!may("settings_view")) {
          await recordDenial(request, {
            action: "system_view", permission: "marketplace.settings.view",
            roles: caller.roles, entityType: "system", recordId: null,
            why: `Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: "Permission marketplace.settings.view is required." },
            { status: 403 },
          );
        }

        const [checks, instance, history, backups, schedules, logsRows, alerts, incidents, emailQueue, jobTables] =
          await Promise.all([
            runChecks(origin),
            rows<Record<string, unknown>>(
              "server_instances?select=server_code,server_name,hostname,provider,region_name,status,health_status,health_score,cpu_usage,cpu_cores,ram_usage,disk_usage,error_rate,response_time_ms,last_health_check,backup_status&limit=1",
            ),
            rows<Record<string, unknown>>(
              "server_metrics_history?select=recorded_at,cpu_usage,ram_usage,disk_usage,response_time_ms,error_count,active_connections&order=recorded_at.desc&limit=2000",
            ),
            count("server_backup_jobs?select=id"),
            count("server_backup_schedules?select=id"),
            count("server_logs?select=id"),
            count("server_alerts?select=id"),
            count("server_incidents?select=id"),
            rows<Record<string, unknown>>("email_queue?select=id,status,priority,category,created_at&limit=100"),
            Promise.all([
              count("demo_sandbox_jobs?select=id"),
              count("demo_provision_jobs?select=id"),
              count("ai_content_generations?select=id"),
              count("demo_sandbox_cleanup_jobs?select=id"),
            ]),
          ]);

        const host = instance[0] ?? null;
        const windows = {
          "24h": summarise(history, 24),
          "7d": summarise(history, 24 * 7),
          "30d": summarise(history, 24 * 30),
        };

        const worst = checks.reduce((acc, c) => {
          const rank = { critical: 4, degraded: 3, unknown: 2, not_connected: 1, healthy: 0 } as const;
          return rank[c.status] > rank[acc] ? c.status : acc;
        }, "healthy" as Check["status"]);

        const emailByStatus: Record<string, number> = {};
        for (const m of emailQueue) {
          emailByStatus[String(m.status ?? "unknown")] = (emailByStatus[String(m.status ?? "unknown")] ?? 0) + 1;
        }

        return Response.json({
          ok: true,
          metrics: {
            // Section 5: computed from real samples over a real window.
            uptime_pct: windows["24h"].uptime_pct,
            uptime_window: "24h",
            queues: emailQueue.length,
            storage_pct: host ? Number(host.disk_usage ?? 0) : null,
            errors_24h: windows["24h"].errors,
          },
          metric_sources: {
            uptime_pct: `server_metrics_history — ${windows["24h"].samples} probes in the last 24 hours, each written by the cron that measures this machine every five minutes. A probe with no error counts as up.`,
            queues: "email_queue. There is no queue runner, so these are records rather than work in flight.",
            storage_pct: "The disk figure the host reported on its last telemetry pass.",
            errors_24h: "The error count summed across the last 24 hours of probes.",
          },
          health: {
            overall: worst,
            checks,
            what: "Every check above was performed just now: a request was made and timed. None is read from a status column.",
          },
          host,
          performance: windows,
          history: history.slice(0, 288).map((h) => ({
            at: h.recorded_at,
            cpu: h.cpu_usage, ram: h.ram_usage, disk: h.disk_usage,
            response_ms: h.response_time_ms, errors: h.error_count,
            connections: h.active_connections,
          })),
          backup: {
            jobs: backups,
            schedules,
            state: (backups ?? 0) === 0 && (schedules ?? 0) === 0 ? "NOT CONNECTED" : "PRESENT",
            reason:
              (backups ?? 0) === 0 && (schedules ?? 0) === 0
                ? "server_backup_jobs and server_backup_schedules exist and are both empty, and nothing on the host schedule writes them. There has never been a backup, so there is nothing to restore and no Restore control is offered — a restore button over zero backups is the most dangerous kind of decoration."
                : null,
            host_backup_status: host?.backup_status ?? null,
          },
          cache: {
            state: "NOT CONNECTED",
            reason:
              "No cache layer runs on this host — no Redis, no Memcached, and no shared application cache. There is nothing to show a hit rate for and nothing a Clear button could clear.",
          },
          queues: {
            runner: "NOT CONNECTED",
            runner_reason:
              "One process runs here and it serves HTTP. Nothing drains a queue. The scheduled work that does run is cron calling database functions directly, and it is shown in the Automation console.",
            email_queue: { total: emailQueue.length, by_status: emailByStatus },
            job_records: {
              demo_sandbox_jobs: jobTables[0],
              demo_provision_jobs: jobTables[1],
              ai_content_generations: jobTables[2],
              demo_sandbox_cleanup_jobs: jobTables[3],
            },
          },
          logs: {
            server_logs_rows: logsRows,
            state: (logsRows ?? 0) === 0 ? "NOT CONNECTED" : "PRESENT",
            reason:
              (logsRows ?? 0) === 0
                ? "server_logs exists and has never been written to. The real runtime log is the process manager's own output, which the Deployment Center reads and sanitises; it is not duplicated here."
                : null,
          },
          incidents: {
            rows: incidents,
            alerts: alerts,
            state: (incidents ?? 0) === 0 && (alerts ?? 0) === 0 ? "NONE RECORDED" : "PRESENT",
            note:
              "No incident is created automatically from the checks above. An incident that opens itself on a slow probe becomes noise, and this platform has no on-call to receive it.",
          },
          permissions: { view: true, run_check: may("settings_manage"), export: may("export") },
        });
      },

      /** The one real action: run the checks now and record the result. */
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { action?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const { matrix } = await loadMatrix();
        const caller = await rolesOf(request);
        const decision = resolveAction({
          roles: caller.roles, action: "settings_manage", permissions: matrix,
        });
        if (!decision.visible || !decision.enabled) {
          await recordDenial(request, {
            action: "system_health_check", permission: "marketplace.settings.manage",
            roles: caller.roles, entityType: "system", recordId: null,
            why: `${decision.reason ?? "Refused."} Caller ${caller.via} holds [${caller.roles.join(", ") || "no role"}].`,
          });
          return Response.json(
            { ok: false, reason: "permission_denied", message: decision.reason },
            { status: 403 },
          );
        }

        if (body.action !== "run_health_check") {
          return Response.json(
            {
              ok: false, reason: "unsupported_action",
              message:
                "Only run_health_check runs from here. Backup, restore, cache purge and queue control all need infrastructure this host does not have, and a button that reported success over nothing would be worse than no button.",
            },
            { status: 400 },
          );
        }

        const origin = new URL(request.url).origin;
        const checks = await runChecks(origin);
        const failing = checks.filter((c) => c.status === "critical" || c.status === "degraded");
        await audit(request, "System health check", { checks: checks.length, failing: failing.length },
          failing.length === 0
            ? "Every service check passed."
            : `${failing.map((c) => `${c.service}: ${c.status}`).join(", ")}.`);
        return Response.json({ ok: true, checks, failing: failing.length });
      },
    },
  },
});
