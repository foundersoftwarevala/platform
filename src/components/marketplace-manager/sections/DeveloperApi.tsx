import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, Download, Loader2, Play, RefreshCw, Search, ShieldCheck, X,
} from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Developer API — a section of the Marketplace Manager, and only that.
 *
 * The screen had five tabs and four blank counters. The counters are now counts
 * of the endpoints this manager really serves, and the REST tab is a registry
 * that checks itself: every endpoint is called without a credential and the
 * answer compared to what the registry claims. When those disagreed the first
 * time, the registry was the thing that was wrong.
 *
 * GraphQL, Webhooks and half of Auth are honest empty states with the reason,
 * because there is no GraphQL server here, the manager emits no outbound
 * events, and issuing API keys needs a table that cannot be created.
 *
 * The static original is kept as ApiSectionStatic.
 */

type Endpoint = {
  id: string; name: string; method: string; path: string; version: string;
  description: string; capability: string; auth: string;
  permission: string | null; scope: string; status: string; file: string;
};

type Check = {
  id: string; expected: number | null; status: number | null;
  agrees: boolean | null; note: string;
};

type Capability = { available: boolean; reason: string | null };

type Data = {
  ok: boolean;
  endpoints: Endpoint[];
  auth_modes: Record<string, string>;
  scopes: { scope: string; endpoints: number; read: boolean }[];
  verification: { checked: number; agree: number; mismatches: number; results: Check[]; what: string };
  telemetry: {
    source: string; what: string; total_recorded: number; denied_attempts: number;
    top_actions: [string, number][]; by_actor_role: [string, number][];
    by_entity: [string, number][]; latest: string | null; outbound_note: string | null;
  };
  version: { current: string; deprecated: string[]; note: string };
  capabilities: Record<string, Capability>;
  permissions: { view: boolean; test: boolean; export: boolean };
};

const TABS = ["REST", "GraphQL", "Webhooks", "Auth", "Logs"];

const METHOD_TONE: Record<string, string> = {
  GET: "border-sky-500/30 text-sky-500",
  POST: "border-emerald-500/30 text-emerald-500",
  PATCH: "border-amber-500/30 text-amber-500",
  PUT: "border-amber-500/30 text-amber-500",
  DELETE: "border-rose-500/30 text-rose-500",
};

export function DeveloperApi() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Endpoint | null>(null);
  const [consoleQuery, setConsoleQuery] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/developer", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The registry could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (endpoint: Endpoint) => {
    setBusy(endpoint.id);
    setResult(null);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/developer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ endpoint_id: endpoint.id, query: consoleQuery }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNote(payload?.message ?? `That call was refused (${response.status}).`);
        return;
      }
      setResult(payload);
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The call did not reach the server.");
    } finally {
      setBusy(null);
    }
  }, [consoleQuery]);

  const exportSpec = useCallback(async (format: "openapi" | "yaml") => {
    setBusy(format);
    try {
      const response = await fetch(`/api/marketplace/developer?format=${format}`, {
        headers: await authHeaders(),
      });
      if (!response.ok) {
        setNote(`The export was refused (${response.status}).`);
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `marketplace-api.${format === "yaml" ? "yaml" : "json"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("The specification was generated from the live registry, so it cannot describe an endpoint that does not exist.");
    } finally {
      setBusy(null);
    }
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.endpoints;
    return data.endpoints.filter((e) =>
      [e.name, e.path, e.method, e.capability, e.scope, e.description]
        .some((v) => String(v).toLowerCase().includes(q)));
  }, [data, query]);

  const checkFor = useCallback(
    (id: string) => data?.verification.results.find((r) => r.id === id) ?? null,
    [data],
  );

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Developer API" title="API" description="REST, GraphQL, webhooks, OAuth/JWT, rate limits and analytics." />
        <LoadFailure error={error} onRetry={load} what="the API registry" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Developer API" title="API" description="REST, GraphQL, webhooks, OAuth/JWT, rate limits and analytics." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the registry and checking every endpoint…</div></Card>
      </div>
    );
  }

  const v = data.verification;
  const cap = data.capabilities;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Developer API"
        title="API"
        description="REST, GraphQL, webhooks, OAuth/JWT, rate limits and analytics."
        actions={
          <>
            {data.permissions.export ? (
              <>
                <PillButton onClick={() => void exportSpec("openapi")} disabled={busy === "openapi"}>
                  <Download className="mr-1 h-3.5 w-3.5" /> OpenAPI JSON
                </PillButton>
                <PillButton onClick={() => void exportSpec("yaml")} disabled={busy === "yaml"}>
                  <Download className="mr-1 h-3.5 w-3.5" /> YAML
                </PillButton>
              </>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Endpoints" value={String(data.endpoints.length)} />
        {/* Section 11: there is no key-issuing system and no limiter here, so
            there is no measurement to report. Zero would claim one. */}
        <StatCard label="Issued keys" value="—" tone="premium" />
        <StatCard label="Rate limits" value="—" tone="warning" />
        <StatCard label="Denied attempts" value={String(data.telemetry.denied_attempts)} tone="destructive" />
      </div>

      <Card className="mb-6">
        <div className="flex items-start gap-2">
          {v.mismatches === 0 ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          )}
          <div className="text-sm">
            <div className="font-medium">
              {v.mismatches === 0
                ? `All ${v.agree} checked endpoints behave as the registry says.`
                : `${v.mismatches} endpoint(s) do not behave as the registry says.`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{v.what}</p>
            {v.mismatches > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-rose-500">
                {v.results.filter((r) => r.agrees === false).map((r) => (
                  <li key={r.id}>{r.id} — {r.note}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Card>

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {tab === "REST" ? (
        <div className="space-y-4">
          <Card>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a path, a capability or a scope"
                aria-label="Search endpoints"
                className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2">Method</th>
                    <th className="px-4 py-2">Endpoint</th>
                    <th className="px-4 py-2">Auth</th>
                    <th className="px-4 py-2">Scope</th>
                    <th className="px-4 py-2">Checked</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => {
                    const check = checkFor(e.id);
                    return (
                      <tr key={`${e.id}`} className="border-b border-border/60">
                        <td className="px-4 py-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${METHOD_TONE[e.method] ?? "border-border"}`}>
                            {e.method}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{e.name}</div>
                          <code className="text-[11px] text-muted-foreground">{e.path}</code>
                          <div className="text-[11px] text-muted-foreground">{e.capability}</div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {e.auth}
                          {e.permission ? <div className="text-[11px] text-muted-foreground">{e.permission}</div> : null}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-muted-foreground">{e.scope}</td>
                        <td className="px-4 py-2 text-xs">
                          {check?.agrees === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="h-3 w-3" /> {check.status}</span>
                          ) : check?.agrees === false ? (
                            <span className="inline-flex items-center gap-1 text-rose-500"><X className="h-3 w-3" /> {check.status}</span>
                          ) : (
                            <span className="text-muted-foreground">not probed</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => { setOpen(e); setResult(null); setConsoleQuery(""); }}
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {open ? (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="text-sm font-semibold">{open.method} {open.path}</div>
                <button onClick={() => setOpen(null)} aria-label="Close endpoint details" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <p>{open.description}</p>
                <div className="text-xs text-muted-foreground">
                  Authentication: {data.auth_modes[open.auth]}
                  {open.permission ? ` Permission checked: ${open.permission}.` : ""}
                </div>
                <div className="text-xs text-muted-foreground">Served by <code>{open.file}</code></div>
                {checkFor(open.id) ? (
                  <div className="text-xs text-muted-foreground">{checkFor(open.id)?.note}</div>
                ) : null}
              </div>

              {/* Section 23: the console runs the real endpoint. Reads only. */}
              {data.permissions.test ? (
                <div className="border-t border-border p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Test console
                  </div>
                  {open.method === "GET" ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={consoleQuery}
                          onChange={(e) => setConsoleQuery(e.target.value)}
                          placeholder="query string, e.g. resource=products&limit=2"
                          aria-label="Query string"
                          className="min-w-[240px] flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm"
                        />
                        <PillButton variant="primary" onClick={() => void run(open)} disabled={busy === open.id}>
                          {busy === open.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                          Send
                        </PillButton>
                      </div>
                      {result ? (
                        <div className="mt-3 space-y-1 text-xs">
                          <div className="text-muted-foreground">
                            HTTP {String(result.status)} · {String(result.latency_ms)} ms · request {String(result.request_id).slice(0, 8)}
                          </div>
                          <pre className="max-h-72 overflow-auto rounded border border-border bg-background p-2 text-[11px]">
                            {JSON.stringify(result.body, null, 2).slice(0, 6000)}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This is a {open.method}. The console runs reads only — a write belongs in the screen that owns it,
                      where its confirmation and its audit reason are asked for.
                    </p>
                  )}
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scopes — derived from the endpoints, not declared beside them
            </div>
            {data.scopes.map((s) => (
              <div key={s.scope} className="flex justify-between border-t border-border px-4 py-2 text-sm">
                <code className="text-xs">{s.scope}</code>
                <span className="text-xs text-muted-foreground">{s.endpoints} endpoint(s)</span>
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {tab === "GraphQL" ? (
        <Card>
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="font-medium">There is no GraphQL server here.</div>
              <p className="mt-1 text-xs text-muted-foreground">{cap.graphql.reason}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Webhooks" ? (
        <Card>
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="font-medium">No webhooks, because no events are emitted.</div>
              <p className="mt-1 text-xs text-muted-foreground">{cap.webhooks.reason}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "Auth" ? (
        <div className="space-y-3">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How a caller authenticates today
            </div>
            {Object.entries(data.auth_modes).map(([mode, description]) => (
              <div key={mode} className="border-t border-border px-4 py-2.5 text-sm">
                <div className="font-medium capitalize">{mode}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
            ))}
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What is and is not available
            </div>
            {(["api_keys", "oauth", "jwt", "rate_limiting"] as const).map((key) => (
              <div key={key} className="border-t border-border px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className={cap[key].available ? "text-emerald-500" : "text-amber-500"}>
                    {cap[key].available ? "✓" : "✕"}
                  </span>
                  <span className="font-medium">{key.replace(/_/g, " ")}</span>
                </div>
                {cap[key].reason ? <p className="mt-1 text-xs text-muted-foreground">{cap[key].reason}</p> : null}
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {tab === "Logs" ? (
        <div className="space-y-3">
          <Card>
            <div className="text-sm font-medium">{data.telemetry.total_recorded} recorded operations</div>
            <p className="mt-1 text-xs text-muted-foreground">{data.telemetry.what}</p>
            {data.telemetry.outbound_note ? (
              <p className="mt-2 text-xs text-amber-500">{data.telemetry.outbound_note}</p>
            ) : null}
          </Card>
          <div className="grid gap-3 lg:grid-cols-3">
            {([
              ["Top actions", data.telemetry.top_actions],
              ["By actor role", data.telemetry.by_actor_role],
              ["By entity", data.telemetry.by_entity],
            ] as const).map(([title, list]) => (
              <Card key={title}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data available.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {list.map(([k, n]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-border/40 pb-1">
                        <span className="truncate text-muted-foreground">{k}</span><span>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
