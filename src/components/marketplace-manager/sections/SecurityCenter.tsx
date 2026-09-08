import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";
import { RoleMatrix } from "./RoleMatrix";

/**
 * Security & Access — five tabs over the real authentication backend.
 *
 * The Roles tab is the matrix that was connected earlier, rendered here rather
 * than rebuilt, because there is one permission matrix on this platform and a
 * second copy of it would start disagreeing with the first.
 *
 * The other four report what the auth backend will actually tell us. Sessions
 * is the honest one: GoTrue has no admin endpoint for listing them —
 * /auth/v1/admin/sessions answers 404 — so the counter is a dash, the tab says
 * NOT CONNECTED, and there is no Revoke button, because a revoke button over an
 * API that does not exist is the fake security this brief rules out first.
 *
 * Two measurements worth reading twice: none of the 84 accounts has a second
 * factor enrolled, and there is no IP rule table on this database at all.
 *
 * The static original is kept as SecuritySectionStatic.
 */

type AuditRow = {
  id: string; action: string; actor: string; actor_role: string;
  entity_type: string; entity_id: string | null; reason: string | null;
  created_at: string; ip_address: string | null;
};

type Data = {
  ok: boolean;
  metrics: { roles: number | null; sessions: number | null; two_factor: number | null; blocked: number | null };
  metric_sources: Record<string, string>;
  roles: {
    distinct: number; assignments: number; breakdown: [string, number][];
    permissions_available: number; note: string;
  };
  audit: { page: number; size: number; total: number | null; rows: AuditRow[]; denied_attempts: number | null; append_only: string };
  sessions: {
    supported: boolean; endpoint_status: number | null; state: string; reason: string | null;
    accounts: number | null; signed_in_ever: number | null; signed_in_last_7_days: number | null;
    recent: { id: string; email: string | null; last_sign_in_at: string | null; days_ago: number | null; confirmed: boolean; banned: boolean }[];
    login_history_rows: number | null; login_history_note: string | null;
  };
  two_factor: {
    enrolled: number | null; accounts: number | null; coverage: number | null;
    state: string; note: string | null; enforcement: string;
  };
  access: {
    ip_rules: number; ip_rules_state: string; ip_rules_reason: string;
    blocked_payment_identifiers: number | null;
    security_events: number | null; security_events_note: string | null;
    alerts: Record<string, unknown>[];
  };
  permissions: { view: boolean; export: boolean; configure: boolean };
};

const TABS = ["Roles", "Audit", "Sessions", "2FA", "Access"];

/** Section 1: an unavailable source is a dash. Never a zero. */
const metric = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

const when = (v: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function SecurityCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: "25" });
      if (debounced.trim()) params.set("q", debounced.trim());
      if (onlyDenied) params.set("result", "denied");
      const response = await fetch(`/api/marketplace/security?${params}`, { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `Security could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, [page, debounced, onlyDenied]);

  useEffect(() => { void load(); }, [load]);

  const exportAudit = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/security", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "export_audit" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setNote(payload?.message ?? `The export was refused (${response.status}).`);
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("Audit exported. The export itself is on the audit trail.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Security & Access" title="Security" description="Roles, permissions, audit logs, sessions, 2FA and IP allowlists." />
        <LoadFailure error={error} onRetry={load} what="the security console" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Security & Access" title="Security" description="Roles, permissions, audit logs, sessions, 2FA and IP allowlists." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the authentication backend…</div></Card>
      </div>
    );
  }

  const pages = data.audit.total ? Math.max(1, Math.ceil(data.audit.total / data.audit.size)) : 1;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Security & Access"
        title="Security"
        description="Roles, permissions, audit logs, sessions, 2FA and IP allowlists."
        actions={
          <>
            {data.permissions.export ? (
              <PillButton onClick={exportAudit} disabled={busy}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export audit
              </PillButton>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Roles" value={metric(data.metrics.roles)} />
        <StatCard label="Sessions" value={metric(data.metrics.sessions)} tone="premium" />
        <StatCard label="2FA" value={metric(data.metrics.two_factor)} tone={data.metrics.two_factor === 0 ? "destructive" : "success"} />
        <StatCard label="Blocked" value={metric(data.metrics.blocked)} tone="destructive" />
      </div>

      {data.two_factor.enrolled === 0 ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-sm">
              <div className="font-medium">
                No account has a second factor. {data.two_factor.enrolled} of {data.two_factor.accounts}.
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{data.two_factor.note}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {/* The one matrix, rendered rather than reimplemented. */}
      {tab === "Roles" ? (
        <div className="-mx-4 md:-mx-8">
          <RoleMatrix />
        </div>
      ) : null}

      {tab === "Audit" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search an action, an actor or a reason"
                  aria-label="Search the audit log"
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox" checked={onlyDenied}
                  onChange={(e) => { setOnlyDenied(e.target.checked); setPage(1); }}
                />
                Refusals only ({metric(data.audit.denied_attempts)})
              </label>
              <span className="text-xs text-muted-foreground">{metric(data.audit.total)} rows</span>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Actor</th>
                    <th className="px-4 py-2">Entity</th>
                    <th className="px-4 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{when(r.created_at)}</td>
                      <td className="px-4 py-2">
                        <span className={r.action.toLowerCase().includes("denied") ? "text-destructive" : ""}>{r.action}</span>
                      </td>
                      <td className="px-4 py-2 text-xs">{r.actor}<div className="text-[11px] text-muted-foreground">{r.actor_role}</div></td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.entity_type}</td>
                      <td className="max-w-md px-4 py-2 text-xs text-muted-foreground">{r.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.audit.rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nothing matches that.</div>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
              <span className="text-muted-foreground">{data.audit.append_only}</span>
              {pages > 1 ? (
                <span className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Previous</button>
                  <span className="px-1 py-1 text-muted-foreground">{page} / {pages}</span>
                  <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
                </span>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Sessions" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="text-sm">
                <div className="font-medium">Sessions: {data.sessions.state}</div>
                <p className="mt-1 text-xs text-muted-foreground">{data.sessions.reason}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  /auth/v1/admin/sessions answered {data.sessions.endpoint_status ?? "nothing"}. This is asked on every
                  load, so if the backend ever gains the endpoint this tab starts working without an edit.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Accounts" value={metric(data.sessions.accounts)} />
            <StatCard label="Signed in at least once" value={metric(data.sessions.signed_in_ever)} tone="success" />
            <StatCard label="Signed in last 7 days" value={metric(data.sessions.signed_in_last_7_days)} tone="premium" />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Most recent sign-ins — from the auth backend, which is authoritative for them
            </div>
            {data.sessions.recent.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="truncate">{u.email ?? u.id.slice(0, 8)}</span>
                  {u.banned ? <span className="ml-2 rounded border border-destructive/40 px-1 text-[10px] text-destructive">banned</span> : null}
                  {!u.confirmed ? <span className="ml-2 rounded border border-amber-500/40 px-1 text-[10px] text-amber-500">unconfirmed</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {when(u.last_sign_in_at)}{u.days_ago !== null ? ` · ${u.days_ago}d ago` : ""}
                </span>
              </div>
            ))}
            {data.sessions.login_history_note ? (
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                {data.sessions.login_history_note}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "2FA" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Enrolled" value={metric(data.two_factor.enrolled)} tone={data.two_factor.enrolled === 0 ? "destructive" : "success"} />
            <StatCard label="Accounts" value={metric(data.two_factor.accounts)} />
            <StatCard label="Coverage" value={data.two_factor.coverage === null ? "—" : `${data.two_factor.coverage}%`} tone="warning" />
          </div>
          <Card>
            <div className="flex items-start gap-2 text-sm">
              {data.two_factor.enrolled === 0
                ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              <div>
                <div className="font-medium">{data.two_factor.state}</div>
                {data.two_factor.note ? <p className="mt-1 text-xs text-muted-foreground">{data.two_factor.note}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{data.two_factor.enforcement}</p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Access" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <div className="font-medium">IP rules: {data.access.ip_rules_state}</div>
                <p className="mt-1 text-xs text-muted-foreground">{data.access.ip_rules_reason}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Security events
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between border-b border-border/40 pb-1">
                <span className="text-muted-foreground">security_events rows</span>
                <span>{metric(data.access.security_events)}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1">
                <span className="text-muted-foreground">Refusals recorded by this console</span>
                <span>{metric(data.audit.denied_attempts)}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Blocked payment identifiers</span>
                <span>{metric(data.access.blocked_payment_identifiers)}</span>
              </div>
            </div>
            {data.access.security_events_note ? (
              <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {data.access.security_events_note}
              </p>
            ) : null}
          </Card>

          {data.access.alerts.length ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Security alerts — {data.access.alerts.length} real rows
              </div>
              {data.access.alerts.map((a, i) => (
                <div key={i} className="border-t border-border px-4 py-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{String(a.title ?? a.alert_type ?? a.message ?? "Alert")}</span>
                    <span className="text-xs text-muted-foreground">
                      {String(a.severity ?? "")} {a.status ? `· ${String(a.status)}` : ""}
                    </span>
                  </div>
                  {a.created_at ? (
                    <div className="text-[11px] text-muted-foreground">{when(String(a.created_at))}</div>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : null}
        </div>
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
