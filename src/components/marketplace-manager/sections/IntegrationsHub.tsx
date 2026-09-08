import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Plug, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Integrations Hub, with the connection statuses checked rather than printed.
 *
 * The database says twelve connectors are connected. Four are. Five declare an
 * inbound webhook at a path this application does not serve, so nothing could
 * ever be delivered to them, and every one of those rows last synced in August.
 *
 * That gap between declared and checked is the whole point of the screen, so it
 * is the first thing on it. A hub that reads a status column and prints it is
 * the thing section 55 is warning about, and this database already contained
 * exactly that.
 *
 * The static original is kept as IntegrationsSectionStatic.
 */

type Connector = {
  id: string; name: string; tab: string; source: string; authority: string;
  category: string; direction: string | null; auth_type: string | null;
  declared_status: string; state: string;
  webhook_url: string | null; webhook_status: number | null;
  credential_env: string | null; credential_present: boolean | null;
  last_sync_at: string | null; days_since_sync: number | null;
  error_count: number; findings: string[];
};

type Data = {
  ok: boolean;
  connectors: Connector[];
  missing: { name: string; tab: string }[];
  metrics: {
    total: number; declared_connected: number; connected: number;
    failing: number; stale: number; not_connected: number;
    events: number; events_breakdown: Record<string, number>;
  };
  consent: { records: number; note: string };
  checks: { webhooks_probed: number; webhooks_reachable: number; stale_after_days: number; what: string };
  permissions: { view: boolean; test: boolean; export: boolean };
};

const TABS = ["Analytics", "Pixels", "Payments", "Finance"];

const STATE_TONE: Record<string, string> = {
  connected: "border-emerald-500/30 text-emerald-500",
  stale: "border-amber-500/30 text-amber-500",
  failing: "border-rose-500/30 text-rose-500",
  not_connected: "border-muted text-muted-foreground",
  unknown: "border-muted text-muted-foreground",
};

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never";

export function IntegrationsHub() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/marketplace/integrations", { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `The hub could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const test = useCallback(async (connector: Connector) => {
    setBusy(connector.id);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id: connector.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setNote(payload?.message ?? `That test was refused (${response.status}).`);
        return;
      }
      // Never a tick the server did not give: success may be true, false or null.
      setNote(`${payload.connector}: ${payload.message}`);
      await load();
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "The test did not reach the server.");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const exportCsv = useCallback(async () => {
    setBusy("export");
    try {
      const response = await fetch("/api/marketplace/integrations?format=csv", { headers: await authHeaders() });
      if (!response.ok) { setNote(`The export was refused (${response.status}).`); return; }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `integrations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("Connector metadata exported. No credential value is included — only whether the variable is set.");
    } finally {
      setBusy(null);
    }
  }, []);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.connectors.filter((c) => {
      if (c.tab !== tab) return false;
      if (state !== "all" && c.state !== state) return false;
      if (!q) return true;
      return [c.name, c.source, c.category, c.declared_status, c.authority]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [data, tab, state, query]);

  const missingHere = useMemo(
    () => data?.missing.filter((m) => m.tab === tab) ?? [],
    [data, tab],
  );

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Integrations Hub" title="Integrations" description="Analytics, pixels, payments and finance connectors — connect once, use everywhere." />
        <LoadFailure error={error} onRetry={load} what="the integrations hub" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Integrations Hub" title="Integrations" description="Analytics, pixels, payments and finance connectors — connect once, use everywhere." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calling every declared webhook and checking every credential…</div></Card>
      </div>
    );
  }

  const m = data.metrics;
  const gap = m.declared_connected - m.connected;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Integrations Hub"
        title="Integrations"
        description="Analytics, pixels, payments and finance connectors — connect once, use everywhere."
        actions={
          <>
            {data.permissions.export ? (
              <PillButton onClick={exportCsv} disabled={busy === "export"}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </PillButton>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Connectors" value={String(m.total)} icon={<Plug className="h-4 w-4" />} />
        <StatCard label="Connected" value={String(m.connected)} tone="success" />
        <StatCard label="Failing" value={String(m.failing)} tone="destructive" />
        <StatCard label="Events" value={String(m.events)} tone="premium" />
      </div>

      {gap > 0 ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div className="text-sm">
              <div className="font-medium">
                {m.declared_connected} connectors say they are connected. {m.connected} are.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.checks.webhooks_probed} declared inbound webhooks were called on this server and{" "}
                {data.checks.webhooks_reachable} answered. {m.stale} connectors last synced more than{" "}
                {data.checks.stale_after_days} days ago. {data.checks.what}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <div className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div>Every connector's declared status matches what the checks found.</div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="text-xs text-muted-foreground">{data.consent.note}</div>
      </Card>

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a provider, a category or an owner"
              aria-label="Search connectors"
              className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <select
            value={state} onChange={(e) => setState(e.target.value)}
            aria-label="Filter by state"
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="all">Any state</option>
            <option value="connected">Connected</option>
            <option value="stale">Stale</option>
            <option value="failing">Failing</option>
            <option value="not_connected">Not connected</option>
          </select>
          <span className="text-xs text-muted-foreground">{visible.length} on this tab</span>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {c.source} · owned by {c.authority}
                  {c.direction ? ` · ${c.direction}` : ""}
                  {c.auth_type ? ` · ${c.auth_type}` : ""}
                </div>
              </div>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${STATE_TONE[c.state]}`}>
                {c.state.replace("_", " ")}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div>
                Record says <span className="text-foreground">{c.declared_status}</span>
                {c.declared_status !== c.state ? " — the checks disagree." : "."}
              </div>
              <div>Last sync: {when(c.last_sync_at)}</div>
              {c.webhook_url ? (
                <div>
                  Webhook <code>{c.webhook_url}</code> answered{" "}
                  <span className={c.webhook_status && c.webhook_status < 400 ? "text-emerald-500" : "text-rose-500"}>
                    {c.webhook_status ?? "nothing"}
                  </span>
                </div>
              ) : null}
              {c.credential_env ? (
                <div>
                  {c.credential_env}: {c.credential_present ? "set" : "not set"}
                </div>
              ) : null}
            </div>

            {c.findings.length ? (
              <ul className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] text-amber-500">
                {c.findings.map((f) => <li key={f}>{f}</li>)}
              </ul>
            ) : null}

            {data.permissions.test ? (
              <div className="mt-3">
                <PillButton onClick={() => void test(c)} disabled={busy === c.id}>
                  {busy === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Test connection
                </PillButton>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">No connector on this tab matches that.</p></Card>
      ) : null}

      {missingHere.length ? (
        <Card className="mt-4">
          <div className="text-sm font-medium">Listed on this screen, absent from the database</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {missingHere.map((x) => x.name).join(", ")} — there is no record of these anywhere, so there is nothing
            to connect, test or report on. They are named here rather than shown as connectors with an empty status.
          </p>
        </Card>
      ) : null}

      <Card className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Where the event count comes from
        </div>
        <div className="space-y-1 text-sm">
          {Object.entries(m.events_breakdown).map(([table, n]) => (
            <div key={table} className="flex justify-between border-b border-border/40 pb-1">
              <code className="text-xs text-muted-foreground">{table}</code>
              <span>{n}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
