import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Loader2, Play, RefreshCw, Server } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * System Health — measured, because this platform measures itself.
 *
 * A cron writes a row about this machine every five minutes, so uptime and
 * performance are computed over real probes rather than typed in. 288 probes
 * covered the last day; 586 cover the week.
 *
 * The health checks on the Health tab are performed when the page loads: each
 * one makes a request and times it. That is why the overall state can disagree
 * with the host's own stored health_status, and when it does, both are shown —
 * a stored status is what something last wrote, a check is what is true now.
 *
 * Backup, Cache and Logs read NOT CONNECTED with the reason. There is no cache
 * layer on this host, no queue runner, and server_backup_jobs and server_logs
 * have never been written to. Section 36 asks for exactly that rather than
 * zeroes dressed up as health.
 *
 * The static original is kept as SystemSectionStatic.
 */

type Check = {
  service: string; status: string; latency_ms: number | null;
  detail: string; checked_at: string;
};

type Window = {
  samples: number; uptime_pct: number | null; avg_response_ms: number | null;
  errors: number | null; max_cpu: number | null; max_disk: number | null;
};

type Data = {
  ok: boolean;
  metrics: {
    uptime_pct: number | null; uptime_window: string;
    queues: number | null; storage_pct: number | null; errors_24h: number | null;
  };
  metric_sources: Record<string, string>;
  health: { overall: string; checks: Check[]; what: string };
  host: Record<string, unknown> | null;
  performance: Record<string, Window>;
  history: { at: string; cpu: number; ram: number; disk: number; response_ms: number; errors: number; connections: number }[];
  backup: { jobs: number | null; schedules: number | null; state: string; reason: string | null; host_backup_status: string | null };
  cache: { state: string; reason: string };
  queues: {
    runner: string; runner_reason: string;
    email_queue: { total: number; by_status: Record<string, number> };
    job_records: Record<string, number | null>;
  };
  logs: { server_logs_rows: number | null; state: string; reason: string | null };
  incidents: { rows: number | null; alerts: number | null; state: string; note: string };
  permissions: { view: boolean; run_check: boolean; export: boolean };
};

const TABS = ["Health", "Backup", "Cache", "Queues", "Logs"];

const metric = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "—" : `${new Intl.NumberFormat().format(v)}${suffix}`;

const TONE: Record<string, string> = {
  healthy: "border-emerald-500/30 text-emerald-500",
  degraded: "border-amber-500/30 text-amber-500",
  critical: "border-rose-500/30 text-rose-500",
  unknown: "border-sky-500/30 text-sky-500",
  not_connected: "border-muted text-muted-foreground",
};

const when = (v: string | null | undefined) =>
  v ? new Date(String(v)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function SystemHealth() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/system", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `System health could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runCheck = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/system", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "run_health_check" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNote(payload?.message ?? `That check was refused (${response.status}).`);
        return;
      }
      setNote(
        payload.failing === 0
          ? "Every service check passed just now."
          : `${payload.failing} service(s) are not healthy right now. The result is on the audit trail.`,
      );
      await load();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The check did not reach the server.");
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="System Health" title="System" description="Backups, cache, queues, logs, storage, performance and health monitoring." />
        <LoadFailure error={error} onRetry={load} what="system health" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="System Health" title="System" description="Backups, cache, queues, logs, storage, performance and health monitoring." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Running the service checks…</div></Card>
      </div>
    );
  }

  const m = data.metrics;
  const host = data.host;
  const storedHealth = host ? String(host.health_status ?? "") : "";
  const disagrees = storedHealth && storedHealth !== data.health.overall;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="System Health"
        title="System"
        description="Backups, cache, queues, logs, storage, performance and health monitoring."
        actions={
          <>
            {data.permissions.run_check ? (
              <PillButton variant="primary" onClick={runCheck} disabled={busy}>
                {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                Run checks
              </PillButton>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Uptime" value={m.uptime_pct === null ? "—" : `${m.uptime_pct}%`} tone={(m.uptime_pct ?? 100) >= 99 ? "success" : "warning"} />
        <StatCard label="Queues" value={metric(m.queues)} tone="premium" />
        <StatCard label="Storage" value={m.storage_pct === null ? "—" : `${m.storage_pct}%`} tone={(m.storage_pct ?? 0) > 80 ? "destructive" : "warning"} />
        <StatCard label="Errors (24h)" value={metric(m.errors_24h)} tone={(m.errors_24h ?? 0) > 0 ? "destructive" : "success"} />
      </div>

      {disagrees ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">
                The host records itself as {storedHealth}; the checks just made say {data.health.overall}.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A stored status is what something last wrote. A check is what answered a moment ago. Both are shown
                rather than one overwriting the other.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {tab === "Health" ? (
        <div className="space-y-3">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Service checks — performed just now
            </div>
            {data.health.checks.map((c) => (
              <div key={c.service} className="flex flex-wrap items-start justify-between gap-2 border-t border-border px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.service}</div>
                  <div className="text-[11px] text-muted-foreground">{c.detail}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {c.latency_ms !== null ? <span className="text-muted-foreground">{c.latency_ms} ms</span> : null}
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${TONE[c.status]}`}>
                    {c.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">{data.health.what}</div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Performance, from the machine's own probes
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-1">Window</th><th className="py-1">Probes</th>
                      <th className="py-1">Uptime</th><th className="py-1">Avg</th>
                      <th className="py-1">Errors</th><th className="py-1">Peak CPU</th><th className="py-1">Peak disk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.performance).map(([label, w]) => (
                      <tr key={label} className="border-b border-border/40">
                        <td className="py-1">{label}</td>
                        <td className="py-1 text-xs text-muted-foreground">{w.samples}</td>
                        <td className="py-1">{w.uptime_pct === null ? "—" : `${w.uptime_pct}%`}</td>
                        <td className="py-1 text-xs">{metric(w.avg_response_ms, " ms")}</td>
                        <td className={`py-1 text-xs ${(w.errors ?? 0) > 0 ? "text-destructive" : ""}`}>{metric(w.errors)}</td>
                        <td className={`py-1 text-xs ${(w.max_cpu ?? 0) >= 95 ? "text-destructive" : ""}`}>{metric(w.max_cpu, "%")}</td>
                        <td className={`py-1 text-xs ${(w.max_disk ?? 0) >= 90 ? "text-destructive" : ""}`}>{metric(w.max_disk, "%")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                The running host
              </div>
              {host ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    {String(host.server_name)} <span className="text-xs text-muted-foreground">({String(host.server_code)})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {String(host.hostname)} · {String(host.provider)} · {String(host.region_name ?? "")}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Stored status</span><span>{String(host.health_status)} ({String(host.health_score)})</span>
                    <span className="text-muted-foreground">CPU</span><span>{String(host.cpu_usage)}% of {String(host.cpu_cores)} cores</span>
                    <span className="text-muted-foreground">Memory</span><span>{String(host.ram_usage)}%</span>
                    <span className="text-muted-foreground">Disk</span><span>{String(host.disk_usage)}%</span>
                    <span className="text-muted-foreground">Response</span><span>{String(host.response_time_ms)} ms</span>
                    <span className="text-muted-foreground">Last telemetry</span><span>{when(String(host.last_health_check))}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No instance is recorded.</p>
              )}
            </Card>
          </div>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Incidents
            </div>
            <div className="text-sm">
              {data.incidents.state}
              <span className="ml-2 text-xs text-muted-foreground">
                {metric(data.incidents.rows)} incidents · {metric(data.incidents.alerts)} alerts
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{data.incidents.note}</p>
          </Card>
        </div>
      ) : null}

      {tab === "Backup" ? (
        <Card>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="text-sm">
              <div className="font-medium">Backup: {data.backup.state}</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.backup.reason}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                server_backup_jobs: {metric(data.backup.jobs)} · server_backup_schedules: {metric(data.backup.schedules)}
                {data.backup.host_backup_status ? ` · the host records its backup status as "${data.backup.host_backup_status}"` : ""}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Cache" ? (
        <Card>
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <div className="font-medium">Cache: {data.cache.state}</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.cache.reason}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Queues" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <div className="font-medium">Queue worker: {data.queues.runner}</div>
                <p className="mt-1 text-xs text-muted-foreground">{data.queues.runner_reason}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              email_queue — {data.queues.email_queue.total} records
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries(data.queues.email_queue.by_status).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                  <span className="text-muted-foreground">{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Job records that do exist
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries(data.queues.job_records).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/40 pb-1">
                  <code className="text-xs text-muted-foreground">{k}</code><span>{metric(v)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              These are executions that really happened, and they are shown with their outcomes in the Automation console.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "Logs" ? (
        <Card>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">Logs: {data.logs.state}</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.logs.reason}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                server_logs: {metric(data.logs.server_logs_rows)} rows.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Where each counter comes from
        </div>
        <div className="space-y-2 text-[11px] text-muted-foreground">
          {Object.entries(data.metric_sources).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium text-foreground">{key.replace(/_/g, " ")}</span> — {value}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
