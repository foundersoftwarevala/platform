import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, Target, BarChart3, CalendarClock, ListChecks,
  Video, FileText, ClipboardList, Trash2, Inbox, TrendingUp,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type CrudRecord } from "@/lib/crud-store";
import { useResellerLeads, type LeadStage } from "@/lib/useResellerLeads";
import { useServerFn } from "@/lib/serverFn";
import {
  addResellerLeadFollowUp,
  listResellerLeadFollowUps,
  setResellerLeadFollowUpDone,
} from "@/lib/reseller-dashboard.functions";
import { LocalOnlyNotice } from "./LocalOnlyNotice";

type Stage = LeadStage;

/** The reason a save failed, as the server said it. */
function reason(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
type Tab = "pipeline" | "analytics";
type DetailTab = "source" | "followup" | "tasks" | "meetings" | "quotes" | "proposals";

const STAGES: { key: Stage; label: string; tone: string }[] = [
  { key: "new",        label: "New",        tone: "bg-surface-2 text-muted-foreground" },
  { key: "contacted",  label: "Contacted",  tone: "bg-[oklch(0.78_0.16_210)]/15 text-[oklch(0.78_0.16_210)]" },
  { key: "qualified",  label: "Qualified",  tone: "bg-brand/15 text-brand" },
  { key: "proposal",   label: "Proposal",   tone: "bg-[oklch(0.75_0.18_300)]/15 text-[oklch(0.78_0.18_300)]" },
  { key: "won",        label: "Won",        tone: "bg-success/15 text-success" },
  { key: "lost",       label: "Lost",       tone: "bg-danger/15 text-danger" },
];

const SOURCES = ["Website", "Referral", "Cold Outreach", "Event", "Partner", "Social", "Inbound Call", "Other"];

export function ResellerLeadsWorkspace({ onBack }: { onBack: () => void }) {
  // Leads are rows in the leads table, which is what the manager reads.
  const crud = useResellerLeads();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crud.records;
    return crud.records.filter((r) =>
      [r.name, String(r.extra.email ?? ""), String(r.extra.company ?? ""), String(r.extra.source ?? "")]
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [crud.records, query]);

  const byStage: Record<Stage, CrudRecord[]> = useMemo(() => {
    const out: any = { new: [], contacted: [], qualified: [], proposal: [], won: [], lost: [] };
    for (const r of filtered) {
      const s = (String(r.extra.stage ?? "new") as Stage);
      (out[s] ?? out.new).push(r);
    }
    return out;
  }, [filtered]);

  const active = activeId ? crud.records.find((r) => r.id === activeId) : null;

  // Said only once the row is saved; a refused move says why and the card
  // stays where the database has it.
  function setStage(id: string, stage: Stage) {
    const rec = crud.records.find((r) => r.id === id);
    if (!rec || rec.extra.stage === stage) return;
    const label = STAGES.find((s) => s.key === stage)?.label ?? stage;
    crud
      .update(id, { extra: { ...rec.extra, stage } })
      .then(() => toast.success(`Moved to ${label}`))
      .catch((error: unknown) => toast.error(reason(error, `That lead was not moved to ${label}.`)));
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <button onClick={active ? () => setActiveId(null) : onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {active ? "Back to pipeline" : "Back to Dashboard"}
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]"><Target className="h-4 w-4" /></div>
          <div>
            <nav className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Reseller Dashboard</span><span>/</span><span className="text-foreground">Leads</span>
              {active && <><span>/</span><span className="text-foreground truncate max-w-[18ch]">{active.name}</span></>}
            </nav>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Leads Pipeline</h1>
          </div>
        </div>
        {!active && (
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-lg bg-surface border border-border p-0.5 flex">
              <TabBtn active={tab === "pipeline"} onClick={() => setTab("pipeline")} icon={ListChecks} label="Pipeline" />
              <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")} icon={BarChart3} label="Analytics" />
            </div>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
              <Plus className="h-3.5 w-3.5" /> New Lead
            </button>
          </div>
        )}
      </header>

      {!active && tab === "pipeline" && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads…"
              className="w-full rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {crud.records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-semibold">No leads in your pipeline yet</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Capture your first lead. You can track source, schedule follow-ups & meetings, send quotes & proposals, and watch the funnel in Analytics.
              </p>
              <button onClick={() => setCreating(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
                <Plus className="h-3.5 w-3.5" /> Add your first lead
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {STAGES.map((s) => (
                <div key={s.key} className="rounded-2xl bg-card border border-border shadow-card flex flex-col min-h-[14rem]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) setStage(id, s.key); }}>
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.tone}`}>{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{byStage[s.key].length}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto scrollbar-thin">
                    {byStage[s.key].length === 0 ? (
                      <div className="text-[10px] text-muted-foreground text-center py-6">Drop leads here</div>
                    ) : byStage[s.key].map((r) => (
                      <button
                        key={r.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                        onClick={() => setActiveId(r.id)}
                        className="w-full text-left rounded-lg border border-border bg-surface hover:bg-surface-2 p-2 transition"
                      >
                        <div className="text-xs font-semibold truncate">{r.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{String(r.extra.company ?? r.extra.email ?? "—")}</div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{String(r.extra.source ?? "—")}</span>
                          <span className="font-semibold text-foreground">${Number(r.extra.value ?? 0).toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!active && tab === "analytics" && <LeadAnalytics records={crud.records} />}

      {active && (
        <LeadDetail
          rec={active}
          onPatch={(p) => crud.update(active.id, p)}
          onStage={(stage) => setStage(active.id, stage)}
          onDelete={() => {
            void crud
              .remove(active.id)
              .then(() => { setActiveId(null); toast.success("Lead removed"); })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "That lead was not removed."),
              );
          }}
        />
      )}

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreate={(v) => {
            void crud
              .create({
                name: v.name,
                extra: { email: v.email, company: v.company, phone: v.phone, source: v.source, value: v.value, stage: "new" as Stage } as any,
              })
              .then((rec) => {
                toast.success("Lead added");
                setCreating(false);
                setActiveId((rec as { id?: string } | undefined)?.id ?? null);
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "That lead was not saved."),
              );
          }}
        />
      )}
    </div>
  );
}

/* ------------ Lead Detail ------------ */

type Patch = (p: Partial<CrudRecord>) => Promise<unknown>;

function LeadDetail({
  rec, onPatch, onStage, onDelete,
}: { rec: CrudRecord; onPatch: Patch; onStage: (stage: Stage) => void; onDelete: () => void }) {
  const [tab, setTab] = useState<DetailTab>("source");
  const stage = String(rec.extra.stage ?? "new") as Stage;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="p-5 border-b border-border flex flex-wrap items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]"><Target className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate">{rec.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {rec.extra.company && <span>{String(rec.extra.company)}</span>}
            {rec.extra.email   && <span>{String(rec.extra.email)}</span>}
            {rec.extra.phone   && <span>{String(rec.extra.phone)}</span>}
            <span>Value: <span className="text-foreground font-semibold">${Number(rec.extra.value ?? 0).toLocaleString()}</span></span>
          </div>
        </div>
        <select value={stage} onChange={(e) => onStage(e.target.value as Stage)}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-xs">
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={onDelete} title="Delete lead" className="grid h-9 w-9 place-items-center rounded-lg bg-surface hover:bg-danger/15 hover:text-danger border border-border">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 pt-3 overflow-x-auto scrollbar-thin border-b border-border">
        {([
          ["source",    "Source",    BarChart3],
          ["followup",  "Follow-up", CalendarClock],
          ["tasks",     "Tasks",     ListChecks],
          ["meetings",  "Meetings",  Video],
          ["quotes",    "Quotes",    ClipboardList],
          ["proposals", "Proposal",  FileText],
        ] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition ${tab === k ? "bg-surface text-foreground border border-border border-b-transparent" : "text-muted-foreground hover:text-foreground"}`}>
            <I className="h-3.5 w-3.5" />{l}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "source"    && <SourceTab rec={rec} onPatch={onPatch} />}
        {tab === "followup"  && <FollowUpsTab leadId={rec.id} kind="followup" placeholder="Email re-engagement, call back Tue 3pm…" icon={CalendarClock} title="Follow-up" />}
        {tab === "tasks"     && <ListTab placeholder="Prepare demo, send pricing sheet…" icon={ListChecks} title="Task" items={[]} unavailable="Lead tasks are not stored yet: the platform has no task list for leads, so nothing typed here would be kept. Use Follow-up for anything with a date." />}
        {tab === "meetings"  && <FollowUpsTab leadId={rec.id} kind="meeting" placeholder="Discovery call · 30 min · Tue 4pm" icon={Video} title="Meeting" />}
        {tab === "quotes"    && <QuoteTab />}
        {tab === "proposals" && <ProposalTab />}
      </div>
    </div>
  );
}

function SourceTab({ rec, onPatch }: { rec: CrudRecord; onPatch: Patch }) {
  const [v, setV] = useState({
    source: String(rec.extra.source ?? ""),
    campaign: String(rec.extra.campaign ?? ""),
    referrer: String(rec.extra.referrer ?? ""),
    utm: String(rec.extra.utm ?? ""),
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await onPatch({ extra: { ...rec.extra, ...v } });
      toast.success("Source saved");
    } catch (error) {
      toast.error(reason(error, "The source was not saved."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Lead source</label>
          <select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}
            className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs">
            <option value="">— Select —</option>
            {/* A source recorded elsewhere (the marketplace, say) is shown as it is. */}
            {v.source && !SOURCES.includes(v.source) && <option value={v.source}>{v.source}</option>}
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Field label="Campaign" value={v.campaign} onChange={(x) => setV({ ...v, campaign: x })} />
        <Field label="Referrer" value={v.referrer} onChange={(x) => setV({ ...v, referrer: x })} />
        <Field label="UTM tag" value={v.utm} onChange={(x) => setV({ ...v, utm: x })} />
      </div>
      <div className="flex justify-end">
        <button onClick={() => void save()} disabled={saving}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">Save source</button>
      </div>
    </div>
  );
}

type ListItem = { id: string; text: string; date: string; done: boolean };

/**
 * Follow-ups and meetings, kept in lead_follow_ups - the table Lead Manager
 * schedules follow-ups in - so the company sees them too.
 */
function FollowUpsTab({
  leadId, kind, placeholder, icon, title,
}: {
  leadId: string; kind: "followup" | "meeting"; placeholder: string;
  icon: React.ComponentType<{ className?: string }>; title: string;
}) {
  const queryClient = useQueryClient();
  const list = useServerFn(listResellerLeadFollowUps);
  const add = useServerFn(addResellerLeadFollowUp);
  const setDone = useServerFn(setResellerLeadFollowUpDone);
  const key = ["reseller", "lead-follow-ups", leadId];
  const query = useQuery({ queryKey: key, queryFn: () => list({ data: { leadId } }) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    // The lead's next follow-up date moves with them.
    void queryClient.invalidateQueries({ queryKey: ["reseller", "leads"] });
  };
  const addMutation = useMutation({
    mutationFn: (v: { text: string; date: string }) => add({ data: { leadId, kind, text: v.text, date: v.date } }),
    onSuccess: refresh,
  });
  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => setDone({ data: v }),
    onSuccess: refresh,
  });
  const items: ListItem[] = (query.data ?? [])
    .filter((f) => (kind === "meeting" ? f.follow_up_type === "meeting" : f.follow_up_type !== "meeting"))
    .map((f) => ({ id: f.id, text: f.notes ?? f.follow_up_type, date: f.scheduled_at.slice(0, 10), done: f.is_completed }));
  return (
    <ListTab
      placeholder={placeholder}
      icon={icon}
      title={title}
      items={items}
      loading={query.isLoading}
      loadError={query.error instanceof Error ? query.error.message : null}
      onAdd={(text, date) => addMutation.mutateAsync({ text, date })}
      onToggle={(id, done) => toggleMutation.mutateAsync({ id, done })}
    />
  );
}

function ListTab({
  placeholder, icon: I, title, items, loading, loadError, onAdd, onToggle, unavailable,
}: {
  placeholder: string; icon: React.ComponentType<{ className?: string }>; title: string;
  items: ListItem[];
  loading?: boolean;
  loadError?: string | null;
  onAdd?: (text: string, date: string) => Promise<unknown>;
  onToggle?: (id: string, done: boolean) => Promise<unknown>;
  /** Set when nothing stores this list: the reason, shown instead of a fake save. */
  unavailable?: string;
}) {
  const [text, setText] = useState(""); const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!text.trim() || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(text.trim(), date || new Date().toISOString().slice(0, 10));
      setText(""); setDate("");
      toast.success(`${title} added`);
    } catch (error) {
      toast.error(reason(error, `That ${title.toLowerCase()} was not saved.`));
    } finally {
      setBusy(false);
    }
  }
  function toggle(item: ListItem) {
    if (!onToggle) return;
    onToggle(item.id, !item.done).catch((error: unknown) =>
      toast.error(reason(error, `That ${title.toLowerCase()} was not updated.`)),
    );
  }
  return (
    <div className="space-y-3">
      {unavailable && <LocalOnlyNotice text={unavailable} />}
      <div className="rounded-xl border border-border bg-surface p-3 grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
        <Field label={title} value={text} onChange={setText} placeholder={placeholder} />
        <Field label="Date" value={date} onChange={setDate} type="date" />
        <button onClick={() => void add()} disabled={!!unavailable || busy || !onAdd} title={unavailable}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
      </div>
      {loading ? <Empty icon={I} text="Loading…" />
        : loadError ? <Empty icon={I} text={loadError} />
        : items.length === 0 ? <Empty icon={I} text={`No ${title.toLowerCase()} items yet.`} /> : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} disabled={!onToggle} />
              <span className={`flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
              <span className="text-muted-foreground">{t.date}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Quotes and proposals for a lead have no table on the platform yet. The forms
// stay, but they say so and save nothing, instead of reporting a save.
const QUOTES_UNAVAILABLE =
  "Quotes are not stored yet: the platform has no quote record for leads, so nothing entered here would be kept.";
const PROPOSALS_UNAVAILABLE =
  "Proposals are not stored yet: the platform has no proposal record for leads, so nothing written here would be kept.";

function QuoteTab() {
  const quotes: { id: string; product: string; amount: number; date: string; status: string }[] = [];
  const [v, setV] = useState({ product: "", amount: 0, status: "sent" });
  return (
    <div className="space-y-3">
      <LocalOnlyNotice text={QUOTES_UNAVAILABLE} />
      <div className="rounded-xl border border-border bg-surface p-3 grid sm:grid-cols-[1fr_140px_140px_auto] gap-2 items-end">
        <Field label="Product / line" value={v.product} onChange={(x) => setV({ ...v, product: x })} />
        <Field label="Amount" value={String(v.amount)} onChange={(x) => setV({ ...v, amount: Number(x) || 0 })} type="number" />
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</label>
          <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}
            className="mt-1 w-full rounded-lg bg-surface border border-border px-2 py-2 text-xs">
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option>
          </select>
        </div>
        <button disabled title={QUOTES_UNAVAILABLE} className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed">Add quote</button>
      </div>
      {quotes.length === 0 ? <Empty icon={ClipboardList} text="No quotes yet." /> : null}
    </div>
  );
}

function ProposalTab() {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  return (
    <div className="space-y-3">
      <LocalOnlyNotice text={PROPOSALS_UNAVAILABLE} />
      <Field label="Proposal title" value={title} onChange={setTitle} placeholder="SalesIQ Pro — 12-month engagement" />
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Proposal body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
          placeholder="Scope, deliverables, milestones, pricing tiers, terms…"
          className="mt-1 w-full rounded-lg bg-surface border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-y" />
      </div>
      <div className="flex justify-end gap-2">
        <button disabled title={PROPOSALS_UNAVAILABLE}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed">Save proposal</button>
      </div>
    </div>
  );
}

/* ------------ Analytics ------------ */

function LeadAnalytics({ records }: { records: CrudRecord[] }) {
  const stats = useMemo(() => {
    const byStage = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<Stage, number>;
    const bySource: Record<string, number> = {};
    let value = 0; let wonValue = 0;
    for (const r of records) {
      const st = String(r.extra.stage ?? "new") as Stage;
      byStage[st] = (byStage[st] ?? 0) + 1;
      const src = String(r.extra.source ?? "Unknown");
      bySource[src] = (bySource[src] ?? 0) + 1;
      const v = Number(r.extra.value ?? 0);
      value += v; if (st === "won") wonValue += v;
    }
    const total = records.length;
    const won = byStage.won, lost = byStage.lost;
    const winRate = won + lost ? (won / (won + lost)) * 100 : 0;
    return { byStage, bySource, value, wonValue, total, winRate };
  }, [records]);

  if (records.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
      <div className="mt-3 text-sm font-semibold">No analytics yet</div>
      <p className="mt-1 text-xs text-muted-foreground">Add leads to start seeing funnel, source mix, win rate and pipeline value.</p>
    </div>
  );

  const maxStage = Math.max(1, ...Object.values(stats.byStage));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KCard label="Total Leads"    value={stats.total.toString()} icon={Target} />
        <KCard label="Pipeline Value" value={`$${stats.value.toLocaleString()}`} icon={TrendingUp} />
        <KCard label="Won Value"      value={`$${stats.wonValue.toLocaleString()}`} icon={TrendingUp} />
        <KCard label="Win Rate"       value={`${stats.winRate.toFixed(1)}%`} icon={BarChart3} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="text-xs font-semibold mb-3">Funnel by stage</div>
        <div className="space-y-2">
          {STAGES.map((s) => {
            const v = stats.byStage[s.key] ?? 0;
            const pct = (v / maxStage) * 100;
            return (
              <div key={s.key} className="flex items-center gap-3 text-xs">
                <div className="w-20 text-muted-foreground">{s.label}</div>
                <div className="flex-1 h-3 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full bg-gradient-brand" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-8 text-right font-semibold">{v}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="text-xs font-semibold mb-3">By source</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {Object.entries(stats.bySource).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-surface/40 p-3 text-xs flex items-center justify-between">
              <span>{k}</span>
              <span className="font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------ New lead dialog ------------ */

function CreateDialog({
  onClose, onCreate,
}: { onClose: () => void; onCreate: (v: { name: string; email: string; company: string; phone: string; source: string; value: number }) => void }) {
  const [v, setV] = useState({ name: "", email: "", company: "", phone: "", source: SOURCES[0], value: 0 });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <div className="text-sm font-semibold">New Lead</div>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          <Field label="Name *"   value={v.name}    onChange={(x) => setV({ ...v, name: x })} />
          <Field label="Company"  value={v.company} onChange={(x) => setV({ ...v, company: x })} />
          <Field label="Email"    value={v.email}   onChange={(x) => setV({ ...v, email: x })} type="email" />
          <Field label="Phone"    value={v.phone}   onChange={(x) => setV({ ...v, phone: x })} />
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Source</label>
            <select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })}
              className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs">
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Estimated value" value={String(v.value)} onChange={(x) => setV({ ...v, value: Number(x) || 0 })} type="number" />
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-surface/40">
          <button onClick={onClose} className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2">Cancel</button>
          <button disabled={!v.name.trim()} onClick={() => onCreate(v)}
            className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed">
            Add lead
          </button>
        </div>
      </div>
    </div>
  );
}

/* helpers */

function TabBtn({ active, onClick, icon: I, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      <I className="h-3.5 w-3.5" />{label}
    </button>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
function Empty({ icon: I, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/40 p-8 text-center">
      <I className="mx-auto h-6 w-6 text-muted-foreground" />
      <div className="mt-2 text-xs text-muted-foreground">{text}</div>
    </div>
  );
}
function KCard({ label, value, icon: I }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <I className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}
function rid() { return Math.random().toString(36).slice(2, 9); }
void Inbox;
