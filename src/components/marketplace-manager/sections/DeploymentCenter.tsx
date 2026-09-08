import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Check, GitBranch, Globe, Link2, Loader2, RefreshCw, Rocket, Server, X,
} from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Deployment Center — Ship to production.
 *
 * The screen listed GitHub, GitLab, Vercel, Netlify, Railway and Cloudflare with
 * a Connect Git button that connected nothing. None of those six has a
 * credential in this environment, so none of them can be connected, and each
 * card now says which variable is missing instead of showing a status.
 *
 * What replaces the empty middle of the screen is the deployment that is real.
 * This application ships by git pull, npm run build and pm2 restart onto one
 * VPS. The repository, branch, commit and working tree are read from the
 * checkout on that host; the instance and its health come from the telemetry
 * the cron writes every five minutes; and the live URLs are checked by actually
 * requesting them.
 *
 * The static original is kept as DeploymentSectionStatic.
 */

type Repo = {
  connected: boolean; provider: string | null; remote: string | null;
  owner: string | null; name: string | null; current_branch: string | null;
  head: { sha: string; short: string; author: string; at: string; subject: string } | null;
  branches: { name: string; commit: string; committed_at: string }[];
  recent_commits: { short: string; author: string; at: string; subject: string }[];
  working_tree_clean: boolean; uncommitted_files: number;
};

type Provider = {
  name: string; kind: string; variables: string[]; present: string[];
  missing: string[]; connectable: boolean; note: string | null;
};

type Health = {
  url: string; status: number | null; latency_ms: number; state: string;
  checked_at: string; https: boolean; error?: string;
};

type Data = {
  ok: boolean;
  metrics: {
    production_instances: number; preview_builds: number; build_records: number;
    health: string; average_build_time_ms: number | null; average_build_note: string;
  };
  pipeline: { what: string; host: Record<string, unknown> | null; repo_dir: string };
  repository: Repo;
  providers: Provider[];
  environment: { name: string; set: boolean; secret: boolean }[];
  domains: Health[];
  demo_urls: Record<string, unknown>[];
  history: { action: string; actor: string; actor_role: string; reason: string | null; created_at: string }[];
  capabilities: Record<string, { available: boolean; reason: string | null }>;
  permissions: { view: boolean; check: boolean; export: boolean };
};

const TABS = ["Overview", "Providers", "Repositories", "Environment", "Builds", "Domains", "Demo URLs", "History"];

const when = (v: string | null | undefined) =>
  v ? new Date(String(v)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const HEALTH_TONE: Record<string, string> = {
  healthy: "border-emerald-500/30 text-emerald-500",
  degraded: "border-amber-500/30 text-amber-500",
  failed: "border-rose-500/30 text-rose-500",
  unknown: "border-muted text-muted-foreground",
};

export function DeploymentCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/deployment", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The deployment centre could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const check = useCallback(async (target: string) => {
    setBusy(target);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "health_check", url: target }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNote(payload?.message ?? `That check was refused (${response.status}).`);
        return;
      }
      setNote(`${payload.url} answered ${payload.status ?? "nothing"} in ${payload.latency_ms} ms — ${payload.state}.`);
      await load();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The check did not reach the server.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Deployment Center" title="Ship to production" description="One-click flow: connect Git provider, select repository and branch, configure environment, deploy, monitor logs and receive live URL." />
        <LoadFailure error={error} onRetry={load} what="the deployment centre" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Deployment Center" title="Ship to production" description="One-click flow: connect Git provider, select repository and branch, configure environment, deploy, monitor logs and receive live URL." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the checkout and requesting the live URLs…</div></Card>
      </div>
    );
  }

  const m = data.metrics;
  const r = data.repository;
  const host = data.pipeline.host as Record<string, unknown> | null;
  const deployable = data.providers.some((p) => p.connectable && p.kind === "target");

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Deployment Center"
        title="Ship to production"
        description="One-click flow: connect Git provider, select repository and branch, configure environment, deploy, monitor logs and receive live URL."
        actions={
          <>
            {/* The two buttons the screen has always had. Neither pretends. */}
            <PillButton onClick={() => setTab("Providers")}>
              <span className="inline-flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Connect Git</span>
            </PillButton>
            <PillButton
              variant="primary"
              onClick={() => setNote(data.capabilities.deploy_from_ui.reason)}
            >
              <span className="inline-flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> New Deployment</span>
            </PillButton>
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Production" value={String(m.production_instances)} icon={<Server className="h-4 w-4" />} />
        <StatCard label="Preview builds" value={String(m.preview_builds)} tone="premium" />
        <StatCard label="Average build time" value={m.average_build_time_ms === null ? "—" : `${m.average_build_time_ms} ms`} tone="warning" />
        <StatCard label="Health" value={m.health} tone={m.health === "healthy" ? "success" : m.health === "failed" ? "destructive" : "warning"} />
      </div>

      {!deployable ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">No deployment provider can be connected from here.</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.capabilities.deploy_from_ui.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.pipeline.what}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {tab === "Overview" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">The running host</div>
            {host ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{String(host.server_name)} <span className="text-xs text-muted-foreground">({String(host.server_code)})</span></div>
                <div className="text-xs text-muted-foreground">{String(host.hostname)} · {String(host.provider)} · {String(host.region_name ?? "")}</div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Health</span>
                  <span className={HEALTH_TONE[String(host.health_status)] ? "" : ""}>{String(host.health_status)} ({String(host.health_score)})</span>
                  <span className="text-muted-foreground">CPU</span><span>{String(host.cpu_usage)}%</span>
                  <span className="text-muted-foreground">Memory</span><span>{String(host.ram_usage)}%</span>
                  <span className="text-muted-foreground">Disk</span><span>{String(host.disk_usage)}%</span>
                  <span className="text-muted-foreground">Response</span><span>{String(host.response_time_ms)} ms</span>
                  <span className="text-muted-foreground">Last check</span><span>{when(String(host.last_health_check))}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No instance is recorded.</p>
            )}
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What ships, and how</div>
            <p className="text-sm text-muted-foreground">{data.pipeline.what}</p>
            <div className="mt-2 space-y-1 text-xs">
              <div><span className="text-muted-foreground">Repository:</span> {r.owner}/{r.name}</div>
              <div><span className="text-muted-foreground">Branch:</span> {r.current_branch}</div>
              <div><span className="text-muted-foreground">Deployed commit:</span> {r.head?.short} — {r.head?.subject}</div>
              <div>
                <span className="text-muted-foreground">Working tree:</span>{" "}
                {r.working_tree_clean ? "clean" : `${r.uncommitted_files} uncommitted file(s)`}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Providers" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.providers.map((p) => (
            <Card key={p.name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.kind === "git" ? "Git provider" : "Deployment target"}</div>
                </div>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${p.connectable ? "border-emerald-500/30 text-emerald-500" : "border-muted text-muted-foreground"}`}>
                  {p.connectable ? "connectable" : "not connected"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {p.variables.map((variable) => (
                  <div key={variable} className="flex items-center gap-1.5">
                    {p.present.includes(variable)
                      ? <Check className="h-3 w-3 text-emerald-500" />
                      : <X className="h-3 w-3 text-rose-500" />}
                    <code>{variable}</code>
                    <span>{p.present.includes(variable) ? "set" : "not set"}</span>
                  </div>
                ))}
              </div>
              {p.note ? (
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-amber-500">{p.note}</p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "Repositories" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold">{r.owner}/{r.name}</div>
                <div className="text-[11px] text-muted-foreground">{r.provider} · <code>{r.remote}</code></div>
              </div>
              <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[11px] text-emerald-500">
                {r.connected ? "connected" : "no remote"}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Read from the checkout on the host, not from a provider API — which is why it works without a GitHub token.
            </p>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Branches
            </div>
            {r.branches.map((b) => (
              <div key={b.name} className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  {b.name}
                  {b.name === r.current_branch ? (
                    <span className="rounded border border-accent/40 px-1 text-[10px] text-accent">current</span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{b.commit} · {when(b.committed_at)}</span>
              </div>
            ))}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent commits
            </div>
            {r.recent_commits.map((c) => (
              <div key={c.short} className="border-t border-border px-4 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{c.subject}</span>
                  <code className="shrink-0 text-xs text-muted-foreground">{c.short}</code>
                </div>
                <div className="text-[11px] text-muted-foreground">{c.author} · {when(c.at)}</div>
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {tab === "Environment" ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Environment — names and whether they are set. Never values.
          </div>
          {data.environment.map((e) => (
            <div key={e.name} className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
              <code className="text-xs">{e.name}</code>
              <span className="flex items-center gap-2 text-xs">
                {e.secret ? <span className="text-muted-foreground">secret</span> : null}
                <span className={e.set ? "text-emerald-500" : "text-rose-500"}>{e.set ? "set" : "not set"}</span>
              </span>
            </div>
          ))}
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            No value is read, returned or exported. A secret that reaches this screen has reached the browser, the
            network log and anyone with the tab open.
          </div>
        </Card>
      ) : null}

      {tab === "Builds" ? (
        <Card>
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="font-medium">No build has ever been recorded.</div>
              <p className="mt-1 text-xs text-muted-foreground">{m.average_build_note}</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.capabilities.build_logs.reason}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Domains" ? (
        <div className="space-y-3">
          {data.domains.map((h) => (
            <Card key={h.url}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={h.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">{h.url}</a>
                </div>
                <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${HEALTH_TONE[h.state]}`}>
                  {h.state}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                HTTP {h.status ?? "no answer"} · {h.latency_ms} ms · checked {when(h.checked_at)}
                {h.error ? ` · ${h.error}` : ""}
              </div>
              {data.permissions.check ? (
                <div className="mt-2">
                  <PillButton onClick={() => void check(h.url)} disabled={busy === h.url}>
                    {busy === h.url ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Check now
                  </PillButton>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "Demo URLs" ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Demo domains
          </div>
          {data.demo_urls.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No demo domain has been created.</p>
          ) : data.demo_urls.map((x, i) => (
            <div key={i} className="border-t border-border px-4 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{String(x.hostname)}</span>
                <span className="text-xs text-muted-foreground">
                  {String(x.status)} · dns {String(x.dns_status)} · {String(x.environment)}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                created {when(String(x.created_at))}
                {x.expires_at ? ` · expires ${when(String(x.expires_at))}` : ""}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {tab === "History" ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deployment activity
          </div>
          {data.history.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nothing has been recorded against deployment yet. Health checks run from this screen appear here.
            </p>
          ) : data.history.map((h, i) => (
            <div key={i} className="border-t border-border px-4 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span>{h.action}</span>
                <span className="text-xs text-muted-foreground">{when(h.created_at)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{h.actor} ({h.actor_role}) — {h.reason ?? "no reason given"}</div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
