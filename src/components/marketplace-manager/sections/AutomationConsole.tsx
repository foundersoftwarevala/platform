import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Download, Loader2, Play, RefreshCw, Search, X, Zap } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * The Automation Engine, connected.
 *
 * Same four tabs and same ten features as the screen it replaces. What changed
 * is that the counters are counts of rows and the health readings are readings.
 *
 * The screen is honest about a split it found rather than smoothing it over.
 * There is a real scheduler here - four cron entries whose freshness is proved
 * by the rows they write - and there is also a set of automation definitions
 * with run counts and success rates that nothing has ever executed. Those are
 * shown under their own heading, marked, and excluded from every number at the
 * top, because a fabricated success rate in a health panel is worse than an
 * empty one.
 *
 * The static original is kept as AutomationSectionStatic.
 */

type Job = {
  job_id: string; automation: string; source: string; trigger: string;
  target: string | null; status: string; attempt: number;
  started_at: string | null; finished_at: string | null;
  duration_ms: number | null; error: string | null; summary: string | null;
};

type Scheduled = {
  id: string; name: string; cron: string; everyMinutes: number; what: string;
  evidence: string | null; last_seen: string | null; age_minutes: number | null;
  state: string; note: string;
  cron_valid: boolean; cron_error: string | null; cron_description: string;
  timezone: string; expected_last_run: string | null; next_run: string | null;
};

type Definition = {
  id: string; table: string; name: string; type: string; enabled: boolean;
  last_run_at: string | null; days_since_run: number | null; runs: number;
  seeded: boolean; has_runner: boolean;
};

type Data = {
  ok: boolean;
  metrics: {
    total: number; running: number; queued: number; failed: number;
    completed: number; partial: number; success_rate: number | null;
    average_duration_ms: number | null; last_successful_run: string | null;
    counted_from: string[];
    excluded: { sources: string[]; rows: number; why: string };
  };
  scheduler: Scheduled[];
  jobs: Job[];
  seeded_history: Job[];
  definitions: Definition[];
  ai: {
    providers: { slug: string; name: string; status: string; api_kind: string | null; generation_enabled: boolean; credential_env: string | null; credential_present: boolean }[];
    models: { name: string; model_id: string; modality: string; is_default: boolean; input_cost_per_1k: number; output_cost_per_1k: number }[];
    routing: { task: string; modality: string; prefers: string; model: string | null; model_id: string | null; provider: string | null; input_cost_per_1k: number | null; runnable: boolean; blocked_by: string | null }[];
    usage: Record<string, unknown>[];
    recent: Record<string, unknown>[];
    stuck: { id: string; minutes: number }[];
  };
  backups: { jobs: number; schedules: number; state: string; note: string };
  runnable: { id: string; label: string; what: string }[];
  permissions: { view: boolean; run: boolean; manage: boolean; restore: boolean };
};

const TABS = ["Tasks", "AI Auto", "Backups", "Schedules"];

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const dur = (v: number | null) =>
  v === null ? "—" : v < 1000 ? `${v} ms` : v < 60000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v / 60000)} min`;

const STATE_TONE: Record<string, string> = {
  HEALTHY: "border-emerald-500/30 text-emerald-500",
  MISSED: "border-rose-500/30 text-rose-500",
  NEVER_RAN: "border-amber-500/30 text-amber-500",
  NO_SIGNAL: "border-sky-500/30 text-sky-500",
  COMPLETED: "border-emerald-500/30 text-emerald-500",
  RUNNING: "border-sky-500/30 text-sky-500",
  QUEUED: "border-muted text-muted-foreground",
  PARTIAL: "border-amber-500/30 text-amber-500",
  FAILED: "border-rose-500/30 text-rose-500",
  BLOCKED: "border-rose-500/30 text-rose-500",
  CANCELLED: "border-muted text-muted-foreground",
};

function Tag({ value }: { value: string }) {
  return (
    <span className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATE_TONE[value] ?? "border-muted text-muted-foreground"}`}>
      {value}
    </span>
  );
}

/** The ten features the screen has always listed, each with its real state. */
const FEATURES = [
  { label: "Scheduled Tasks", key: "scheduler" },
  { label: "Auto SEO", key: "ai" },
  { label: "Auto Blog", key: "ai" },
  { label: "Auto Tags", key: "ai" },
  { label: "Auto Thumbnail", key: "ai" },
  { label: "Auto Gallery", key: "ai" },
  { label: "Auto Translation", key: "translate" },
  { label: "Auto Documentation", key: "ai" },
  { label: "Auto Reports", key: "reports" },
  { label: "Auto Backup", key: "backup" },
];

export function AutomationConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [jobQuery, setJobQuery] = useState("");
  const [jobStatus, setJobStatus] = useState("all");
  const [jobSource, setJobSource] = useState("all");
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/automation", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The console could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(
    async (id: string, preview: boolean) => {
      setBusy(id);
      setNote(null);
      try {
        const response = await fetch("/api/marketplace/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ id, preview }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          // Section 33: no success is shown that the server did not report.
          setNote(payload?.message ?? payload?.error ?? `That run failed (${response.status}).`);
          return;
        }
        setNote(
          payload.preview
            ? `${payload.label}: ${payload.what} ${payload.message}`
            : `${payload.label} finished in ${dur(payload.duration_ms)}.`,
        );
        if (!payload.preview) await load();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : "That run did not reach the server.");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  /** Section 19. The same rows the screen counts, as a file. */
  const exportHealth = useCallback(async () => {
    setBusy("report");
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/automation?format=csv", {
        headers: await authHeaders(),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setNote(payload?.message ?? payload?.error ?? `The report was refused (${response.status}).`);
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `automation-health-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("Automation health exported. The export is on the audit trail.");
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The report could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }, []);

  /** Sections 31 and 32, over the executions rather than over everything. */
  const executions = useMemo(() => {
    if (!data) return [];
    return data.jobs.filter((j) => !data.metrics.excluded.sources.includes(j.source));
  }, [data]);

  const visibleJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    return executions.filter((j) => {
      if (jobStatus !== "all" && j.status !== jobStatus) return false;
      if (jobSource !== "all" && j.source !== jobSource) return false;
      if (!q) return true;
      return [j.automation, j.source, j.status, j.summary, j.error, j.target, j.job_id]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [executions, jobQuery, jobStatus, jobSource]);

  const featureState = useMemo(() => {
    if (!data) return {};
    const translate = data.ai.routing.find((r) => r.modality === "translate");
    const anyAi = data.ai.routing.some((r) => r.modality !== "translate" && r.runnable);
    return {
      scheduler: data.scheduler.some((s) => s.state === "HEALTHY")
        ? { tone: "ok", text: "Running on the host schedule." }
        : { tone: "bad", text: "No scheduled task is reporting." },
      ai: anyAi
        ? { tone: "ok", text: "A provider is configured." }
        : { tone: "bad", text: "No AI provider has a credential in this environment." },
      translate: translate?.runnable
        ? { tone: "ok", text: "Translation provider configured." }
        : { tone: "bad", text: translate?.blocked_by ?? "No translation provider." },
      reports: { tone: "warn", text: "Reads real analytics; no scheduled delivery." },
      backup: data.backups.state === "NEVER_RUN"
        ? { tone: "bad", text: "Never run. Nothing schedules a backup." }
        : { tone: "ok", text: "Backup records exist." },
    } as Record<string, { tone: string; text: string }>;
  }, [data]);

  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Automation Engine" title="Automation" description="Scheduled tasks, AI automation, backups and schedules." />
        <LoadFailure error={error} onRetry={load} what="the automation console" />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader eyebrow="Automation Engine" title="Automation" description="Scheduled tasks, AI automation, backups and schedules." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading real job records…</div></Card>
      </div>
    );
  }

  const m = data.metrics;

  return (
    <div>
      <PageHeader
        eyebrow="Automation Engine"
        title="Automation"
        description="Every figure here is a count of rows that exist. Definitions nothing executes are listed separately and counted in nothing."
        actions={
          <>
            <PillButton onClick={exportHealth} disabled={busy === "report"}>
              <Download className="mr-1 h-3.5 w-3.5" /> Export health
            </PillButton>
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total jobs" value={n(m.total)} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Running" value={n(m.running)} tone="success" />
        <StatCard label="Queued" value={n(m.queued)} tone="warning" />
        <StatCard label="Failed or blocked" value={n(m.failed)} tone="destructive" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Success rate" value={m.success_rate === null ? "—" : `${m.success_rate}%`} />
        <StatCard label="Average duration" value={dur(m.average_duration_ms)} />
        <StatCard label="Last successful run" value={when(m.last_successful_run)} tone="premium" />
        <StatCard label="Excluded rows" value={n(m.excluded.rows)} tone="warning" />
      </div>

      <Card className="mb-6">
        <div className="text-xs text-muted-foreground">
          Counted from {m.counted_from.join(", ")}. Not counted: {m.excluded.sources.join(", ")} — {m.excluded.why}
        </div>
      </Card>

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {tab === "Tasks" ? (
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Run now — the sweeps the scheduler already calls
            </div>
            <div className="p-4 text-xs text-muted-foreground">
              These are idempotent server functions the host cron runs anyway, so running one by hand does
              what the next pass would have done. Nothing else is offered: there is no worker and no job
              queue here, and a Run Now that resolved to a success nobody executed would be a lie.
            </div>
            {data.runnable.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.what}</div>
                </div>
                {data.permissions.run ? (
                  <div className="flex gap-2">
                    <PillButton onClick={() => void run(r.id, true)} disabled={busy === r.id}>Preview</PillButton>
                    <PillButton variant="primary" onClick={() => void run(r.id, false)} disabled={busy === r.id}>
                      {busy === r.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                      Run now
                    </PillButton>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Your role cannot run automations.</span>
                )}
              </div>
            ))}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent jobs — real executions
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                  placeholder="Search a job, an automation or an error"
                  aria-label="Search jobs"
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
                />
              </div>
              <select
                value={jobStatus} onChange={(e) => setJobStatus(e.target.value)}
                aria-label="Filter by status"
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="all">Any status</option>
                {[...new Set(executions.map((j) => j.status))].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select
                value={jobSource} onChange={(e) => setJobSource(e.target.value)}
                aria-label="Filter by automation"
                className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="all">Any automation</option>
                {[...new Set(executions.map((j) => j.source))].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {visibleJobs.length} of {executions.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2">Automation</th><th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Started</th><th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2">Attempt</th><th className="px-4 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((j) => (
                    <tr
                      key={j.job_id}
                      onClick={() => setOpenJob(j)}
                      className="cursor-pointer border-b border-border/60 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2">{j.automation}</td>
                      <td className="px-4 py-2"><Tag value={j.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{when(j.started_at)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{dur(j.duration_ms)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{j.attempt}</td>
                      <td className="max-w-md px-4 py-2 text-xs text-muted-foreground">{j.error ?? j.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleJobs.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No job matches those filters.</div>
              ) : null}
            </div>
          </Card>

          {/* Section 35: opening a job shows what it did, not just that it
              happened. Nothing here is computed for display - every field is
              the field the job table holds. */}
          {openJob ? (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Job {openJob.job_id.slice(0, 8)}
                </div>
                <button onClick={() => setOpenJob(null)} aria-label="Close job details" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
                {[
                  ["Automation", openJob.automation],
                  ["Source table", openJob.source],
                  ["Trigger", openJob.trigger],
                  ["Target", openJob.target ?? "—"],
                  ["Status", openJob.status],
                  ["Attempt", String(openJob.attempt)],
                  ["Created", when(openJob.created_at)],
                  ["Started", when(openJob.started_at)],
                  ["Finished", when(openJob.finished_at)],
                  ["Duration", dur(openJob.duration_ms)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              {openJob.error ? (
                <div className="border-t border-border px-4 py-3">
                  <div className="text-xs font-medium text-rose-500">Error</div>
                  <div className="mt-1 text-sm text-muted-foreground">{openJob.error}</div>
                </div>
              ) : null}
              {openJob.summary ? (
                <div className="border-t border-border px-4 py-3">
                  <div className="text-xs font-medium text-muted-foreground">Result</div>
                  <div className="mt-1 text-sm">{openJob.summary}</div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Definitions with nothing behind them — {data.definitions.length} rows
            </div>
            <div className="p-4 text-xs text-muted-foreground">
              These rows describe automations and carry run counts and success rates. No process on this
              platform executes any of them, and their next scheduled run is in the past. They are listed so
              nobody has to discover that the hard way, and they are excluded from every figure above.
            </div>
            <div className="max-h-80 overflow-y-auto">
              {data.definitions.map((d) => (
                <div key={`${d.table}-${d.id}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{d.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{d.table} · {d.type || "—"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {d.seeded ? <Tag value="SEEDED" /> : null}
                    <span>{n(d.runs)} runs claimed</span>
                    <span>{d.days_since_run === null ? "never run" : `${d.days_since_run}d ago`}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "AI Auto" ? (
        <div className="space-y-6">
          {data.ai.stuck.length ? (
            <Card>
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <div className="font-medium">{data.ai.stuck.length} generation started and never finished.</div>
                  <div className="text-xs text-muted-foreground">
                    {data.ai.stuck.map((s) => `${s.id.slice(0, 8)} — running for ${s.minutes} minutes`).join("; ")}.
                    A job that never ends is not quietly dropped here; it stays visible until somebody deals with it.
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Model routing — each task to the model it needs
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2">Automation</th><th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Model</th><th className="px-4 py-2">Input / 1k</th>
                    <th className="px-4 py-2">Can run</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ai.routing.map((r) => (
                    <tr key={r.task} className="border-b border-border/60">
                      <td className="px-4 py-2">{r.task}<div className="text-xs text-muted-foreground">{r.prefers}</div></td>
                      <td className="px-4 py-2 text-xs">{r.provider ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{r.model_id ?? r.model ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{r.input_cost_per_1k === null ? "—" : `$${r.input_cost_per_1k}`}</td>
                      <td className="px-4 py-2 text-xs">
                        {r.runnable ? <Tag value="COMPLETED" /> : <span className="text-muted-foreground">{r.blocked_by}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Providers — {data.ai.providers.filter((p) => p.credential_present).length} of {data.ai.providers.length} hold a credential
            </div>
            {data.ai.providers.map((p) => (
              <div key={p.slug} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm">
                <span>{p.name}<span className="ml-2 text-xs text-muted-foreground">{p.api_kind ?? "not a text provider"}</span></span>
                <span className="text-xs text-muted-foreground">
                  {p.credential_env ? `${p.credential_env}: ${p.credential_present ? "set" : "not set"}` : "no credential needed"}
                </span>
              </div>
            ))}
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Only whether a variable is set is reported. No credential value leaves the server.
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Backups" ? (
        <Card>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="space-y-2 text-sm">
              <div className="font-medium">
                {data.backups.state === "NEVER_RUN" ? "There has never been a backup." : "Backup records exist."}
              </div>
              <p className="text-muted-foreground">{data.backups.note}</p>
              <p className="text-xs text-muted-foreground">
                server_backup_jobs: {n(data.backups.jobs)} · server_backup_schedules: {n(data.backups.schedules)}.
                A second backup engine is not being built here — the tables the platform already has are the
                ones that would be used, and what is missing is the process that writes them.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Schedules" ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            The host schedule — health read from the rows each one writes
          </div>
          {data.scheduler.map((s) => (
            <div key={s.id} className="border-t border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {s.name}
                    <code className="rounded bg-muted px-1 text-[11px]">{s.cron}</code>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.what}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tag value={s.state} />
                  <span>{when(s.last_seen)}</span>
                </div>
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Cadence: {s.cron_description}</span>
                <span>Next run: {when(s.next_run)}</span>
                <span>Timezone: {s.timezone}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.cron_valid ? s.note : `This expression does not parse: ${s.cron_error}`}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          The ten features, and where each one actually stands
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {FEATURES.map((f) => {
            const state = featureState[f.key] ?? { tone: "warn", text: "—" };
            return (
              <div key={f.label} className="bg-background px-4 py-2.5">
                <div className="text-sm font-medium">{f.label}</div>
                <div className={`text-xs ${state.tone === "ok" ? "text-emerald-500" : state.tone === "bad" ? "text-rose-500" : "text-amber-500"}`}>
                  {state.text}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
