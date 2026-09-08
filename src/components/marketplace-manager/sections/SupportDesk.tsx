import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2, MessageSquare, RefreshCw, Search, X } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, LoadFailure, PageHeader, PillButton, StatCard, SubNav } from "../ui";

/**
 * Support Desk, over the support records that already exist.
 *
 * This screen had four blank counters over six feature chips. Behind them was
 * the richest real dataset in the console: 11 tickets with priority, channel
 * and SLA columns, 5 escalations, 5 chat sessions, 28 published FAQs and 6
 * knowledge articles.
 *
 * CSAT stays a dash, and that is the point of it. The column exists on every
 * ticket and not one row has a value, so there is no satisfaction score —
 * averaging nothing would be the easiest fake on this screen. Same for
 * first-response time: first_response_at is null on all eleven.
 *
 * The queue is also dated rather than presented as live. The newest ticket is
 * twenty days old, which is worth knowing before anybody reads this as today's
 * work.
 *
 * The static original is kept as SupportSectionStatic.
 */

type Ticket = Record<string, unknown> & {
  id: string; reference?: string; subject?: string; status?: string;
  priority?: string; category?: string; channel?: string;
  customer_name?: string; assigned_to?: string; created_at?: string;
  sla_breached?: boolean; sla_minutes_remaining?: number | null;
  description?: string; csat?: number | null; resolved_at?: string | null;
};

type Data = {
  ok: boolean;
  metrics: { tickets: number | null; open: number | null; resolved: number | null; csat: number | null };
  metric_sources: Record<string, string>;
  freshness: { newest_ticket_days_ago: number | null; note: string | null };
  tickets: {
    page: number; size: number; total: number | null; rows: Ticket[];
    breakdown: { status: Record<string, number>; priority: Record<string, number>; channel: Record<string, number>; category: Record<string, number> };
    assigned: number;
  };
  sla: {
    breached: number; first_response_recorded: number; first_response_note: string | null;
    average_resolution_hours: number | null; resolution_sample: number;
  };
  escalations: { rows: Record<string, unknown>[]; open: number; by_level: Record<string, number> };
  chat: {
    sessions: Record<string, unknown>[]; messages: number | null; active: number;
    architecture: string; bots: Record<string, unknown>[];
  };
  knowledge: { articles: Record<string, unknown>[]; published: number; drafts: number; counters_note: string };
  faqs: {
    total: number; published: number; ai_generated: number;
    categories: Record<string, unknown>[]; rows: Record<string, unknown>[];
    versions: number | null; versions_note: string | null;
  };
  announcements: { state: string; reason: string };
  quick_requests: number | null;
  permissions: { view: boolean; edit: boolean; export: boolean };
};

const TABS = ["Tickets", "Live Chat", "Knowledge Base", "Docs", "FAQs"];

const metric = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat().format(v);

const when = (v: unknown) =>
  v ? new Date(String(v)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const PRIORITY_TONE: Record<string, string> = {
  critical: "border-rose-500/40 text-rose-500",
  high: "border-amber-500/40 text-amber-500",
  medium: "border-sky-500/40 text-sky-500",
  low: "border-muted text-muted-foreground",
};

export function SupportDesk() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("created_at.desc");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ status, priority, sort, page: String(page), size: "25" });
      if (debounced.trim()) params.set("q", debounced.trim());
      const response = await fetch(`/api/marketplace/support?${params}`, { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `Support could not be read (${response.status}).`);
        return;
      }
      setData(payload as Data);
    } catch (cause) {
      setError(cause);
    }
  }, [status, priority, sort, page, debounced]);

  useEffect(() => { void load(); }, [load]);

  const exportTickets = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/marketplace/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "export_tickets" }),
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
      link.download = `support-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setNote("Tickets exported. Descriptions and message bodies were left out — an export is the easiest way for customer text to leave the building.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (error) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Support Desk" title="Support" description="Tickets, live chat, knowledge base, documentation and announcements." />
        <LoadFailure error={error} onRetry={load} what="the support desk" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-8">
        <PageHeader eyebrow="Support Desk" title="Support" description="Tickets, live chat, knowledge base, documentation and announcements." />
        <Card><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading the support records…</div></Card>
      </div>
    );
  }

  const pages = data.tickets.total ? Math.max(1, Math.ceil(data.tickets.total / data.tickets.size)) : 1;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Support Desk"
        title="Support"
        description="Tickets, live chat, knowledge base, documentation and announcements."
        actions={
          <>
            {data.permissions.export ? (
              <PillButton onClick={exportTickets} disabled={busy}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </PillButton>
            ) : null}
            <PillButton onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh</PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tickets" value={metric(data.metrics.tickets)} />
        <StatCard label="Open" value={metric(data.metrics.open)} tone="warning" />
        <StatCard label="Resolved" value={metric(data.metrics.resolved)} tone="success" />
        <StatCard label="CSAT" value={metric(data.metrics.csat)} tone="premium" />
      </div>

      {data.metrics.csat === null ? (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <div className="font-medium">CSAT is a dash, not a zero.</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.metric_sources.csat}</p>
              {data.sla.first_response_note ? (
                <p className="mt-1 text-xs text-muted-foreground">{data.sla.first_response_note}</p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {data.freshness.note ? (
        <Card className="mb-6">
          <div className="text-xs text-muted-foreground">
            Newest ticket is {data.freshness.newest_ticket_days_ago} days old. {data.freshness.note}
          </div>
        </Card>
      ) : null}

      {note ? <Card className="mb-6"><div className="text-sm">{note}</div></Card> : null}

      <SubNav items={TABS} active={tab} onChange={setTab} />

      {tab === "Tickets" ? (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a subject, a customer or a reference"
                  aria-label="Search tickets"
                  className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm"
                />
              </div>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                aria-label="Filter by status"
                className="rounded-md border border-border bg-background px-2 py-2 text-sm">
                <option value="all">Any status</option>
                {Object.keys(data.tickets.breakdown.status).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}
                aria-label="Filter by priority"
                className="rounded-md border border-border bg-background px-2 py-2 text-sm">
                <option value="all">Any priority</option>
                {Object.keys(data.tickets.breakdown.priority).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                aria-label="Sort"
                className="rounded-md border border-border bg-background px-2 py-2 text-sm">
                <option value="created_at.desc">Newest</option>
                <option value="created_at.asc">Oldest</option>
                <option value="updated_at.desc">Recently updated</option>
                <option value="priority.asc">Priority</option>
                <option value="sla_minutes_remaining.asc">SLA remaining</option>
              </select>
              <span className="text-xs text-muted-foreground">{metric(data.tickets.total)} matching</span>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2">Ticket</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Priority</th>
                    <th className="px-4 py-2">Channel</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">SLA</th>
                    <th className="px-4 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickets.rows.map((t) => (
                    <tr key={t.id} onClick={() => setOpen(t)}
                      className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <div className="font-medium">{String(t.subject ?? "—")}</div>
                        <div className="text-[11px] text-muted-foreground">{String(t.reference ?? t.id).slice(0, 24)}</div>
                      </td>
                      <td className="px-4 py-2 text-xs">{String(t.status ?? "—")}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[11px] ${PRIORITY_TONE[String(t.priority)] ?? "border-muted text-muted-foreground"}`}>
                          {String(t.priority ?? "—")}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{String(t.channel ?? "—")}</td>
                      <td className="px-4 py-2 text-xs">{String(t.customer_name ?? "—")}</td>
                      <td className="px-4 py-2 text-xs">
                        {t.sla_breached ? <span className="text-destructive">breached</span>
                          : t.sla_minutes_remaining !== null && t.sla_minutes_remaining !== undefined
                            ? `${t.sla_minutes_remaining} min` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{when(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tickets.rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No ticket matches that.</div>
              ) : null}
            </div>
            {pages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs">
                <span className="text-muted-foreground">Page {data.tickets.page} of {pages}</span>
                <span className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Previous</button>
                  <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
                </span>
              </div>
            ) : null}
          </Card>

          {open ? (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="text-sm font-semibold">{String(open.subject ?? "Ticket")}</div>
                <button onClick={() => setOpen(null)} aria-label="Close ticket" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
                {([
                  ["Reference", open.reference], ["Status", open.status],
                  ["Priority", open.priority], ["Category", open.category],
                  ["Channel", open.channel], ["Customer", open.customer_name],
                  ["Assigned to", open.assigned_to], ["Created", when(open.created_at)],
                  ["Resolved", when(open.resolved_at)], ["SLA breached", String(open.sla_breached)],
                  ["CSAT", open.csat ?? "—"],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
                  </div>
                ))}
              </dl>
              {open.description ? (
                <div className="border-t border-border px-4 py-3">
                  <div className="text-xs font-medium text-muted-foreground">Description</div>
                  <p className="mt-1 text-sm">{String(open.description)}</p>
                </div>
              ) : null}
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                Replying and status changes are not offered here. A reply has to distinguish a customer-visible message
                from an internal note, and there is no ticket message table on this database to hold either.
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escalations — {data.escalations.open} open of {data.escalations.rows.length}
            </div>
            {data.escalations.rows.map((e, i) => (
              <div key={i} className="border-t border-border px-4 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>Level {String(e.level)} — {String(e.reason ?? "")}</span>
                  <span className="text-xs text-muted-foreground">{String(e.status)}</span>
                </div>
                {e.resolution_notes ? (
                  <div className="text-[11px] text-muted-foreground">{String(e.resolution_notes)}</div>
                ) : null}
              </div>
            ))}
          </Card>
        </div>
      ) : null}

      {tab === "Live Chat" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Active sessions" value={metric(data.chat.active)} tone="success" />
            <StatCard label="Sessions" value={metric(data.chat.sessions.length)} />
            <StatCard label="Messages" value={metric(data.chat.messages)} tone="premium" />
          </div>
          <Card>
            <div className="text-xs text-muted-foreground">{data.chat.architecture}</div>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sessions
            </div>
            {data.chat.sessions.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  {String(s.visitor_email ?? s.id ?? "").slice(0, 32) || "visitor"}
                </span>
                <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{String(s.channel ?? "")}</span>
                  <span>{String(s.status ?? "")}</span>
                  {s.sentiment ? <span>{String(s.sentiment)}</span> : null}
                  <span>{when(s.started_at)}</span>
                </span>
              </div>
            ))}
          </Card>
          {data.chat.bots.length ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bots
              </div>
              {data.chat.bots.map((b, i) => (
                <div key={i} className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-2 text-sm">
                  <span>{String(b.name)} <span className="text-xs text-muted-foreground">{String(b.channel ?? "")}</span></span>
                  <span className="text-xs text-muted-foreground">
                    {String(b.status ?? "")} · {String(b.conversations ?? 0)} conversations · {String(b.resolution_rate ?? "—")}% resolved
                  </span>
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "Knowledge Base" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Published" value={metric(data.knowledge.published)} tone="success" />
            <StatCard label="Drafts" value={metric(data.knowledge.drafts)} tone="warning" />
          </div>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Articles
            </div>
            {data.knowledge.articles.map((a, i) => (
              <div key={i} className="border-t border-border px-4 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{String(a.title)}</span>
                  <span className="text-xs text-muted-foreground">
                    {String(a.status)} · {String(a.category ?? "")}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {String(a.views ?? 0)} views · {String(a.helpful_count ?? 0)} marked helpful · updated {when(a.updated_at)}
                </div>
              </div>
            ))}
            <div className="border-t border-border px-4 py-2 text-[11px] text-amber-500">
              {data.knowledge.counters_note}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Docs" ? (
        <Card>
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="font-medium">Announcements: {data.announcements.state}</div>
              <p className="mt-1 text-xs text-muted-foreground">{data.announcements.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Product documentation lives with the products themselves and in the knowledge base above; there is no
                separate documentation table on this database, so nothing is duplicated here.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {tab === "FAQs" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="FAQs" value={metric(data.faqs.total)} />
            <StatCard label="Published" value={metric(data.faqs.published)} tone="success" />
            <StatCard label="Categories" value={metric(data.faqs.categories.length)} tone="premium" />
          </div>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categories
            </div>
            {data.faqs.categories.map((c, i) => (
              <div key={i} className="flex justify-between border-t border-border px-4 py-2 text-sm">
                <span>{String(c.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {c.enabled ? "enabled" : "disabled"} · {String(c.slug ?? "")}
                </span>
              </div>
            ))}
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Questions — all {data.faqs.published} of {data.faqs.total} are published
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.faqs.rows.map((f, i) => (
                <div key={i} className="border-t border-border px-4 py-2 text-sm">
                  {String(f.question)}
                  <span className="ml-2 text-[11px] text-muted-foreground">{String(f.language ?? "")}</span>
                </div>
              ))}
            </div>
            {data.faqs.versions_note ? (
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                {data.faqs.versions_note}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      <Card className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Where each counter comes from
        </div>
        <div className="space-y-2 text-[11px] text-muted-foreground">
          {Object.entries(data.metric_sources).map(([key, value]) => (
            <div key={key}>
              <span className="font-medium text-foreground">{key}</span> — {value}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
