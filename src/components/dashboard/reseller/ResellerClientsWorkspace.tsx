import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, UserCheck, Mail, Phone, Building2, MapPin, Star,
  ShoppingCart, FileBadge, StickyNote, FileText, CalendarClock, MessageSquare,
  Paperclip, Pencil, Trash2, Activity, Heart, Inbox,
} from "lucide-react";
import { useCrud, type CrudRecord } from "@/lib/crud-store";

type Tab = "profile" | "purchases" | "licenses" | "notes" | "documents" | "followup" | "timeline";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile",   label: "Profile",     icon: UserCheck },
  { key: "purchases", label: "Purchase History", icon: ShoppingCart },
  { key: "licenses",  label: "License History",  icon: FileBadge },
  { key: "notes",     label: "Notes",       icon: StickyNote },
  { key: "documents", label: "Documents",   icon: FileText },
  { key: "followup",  label: "Follow Up",   icon: CalendarClock },
  { key: "timeline",  label: "Timeline",    icon: MessageSquare },
];

export function ResellerClientsWorkspace({ onBack }: { onBack: () => void }) {
  const crud = useCrud("reseller", "clients");
  const licenses = useCrud("reseller", "licenses");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("profile");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crud.records;
    return crud.records.filter((r) =>
      [r.name, r.owner, String(r.extra.email ?? ""), String(r.extra.company ?? "")]
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [crud.records, query]);

  const active = (selectedId ? crud.records.find((r) => r.id === selectedId) : null) ?? null;
  const clientLicenses = active
    ? licenses.records.filter((l) => l.extra.clientId === active.id)
    : [];

  return (
    <div className="space-y-5">
      <Header onBack={onBack} active={active} onClearActive={() => setSelectedId(null)} />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* List */}
        <aside className="rounded-2xl border border-border bg-card shadow-card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => { setAdding(true); setSelectedId(null); }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow"
            >
              <Plus className="h-3.5 w-3.5" /> New Client
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <UserCheck className="mx-auto h-6 w-6 mb-2 opacity-60" />
                No clients yet. Create your first to start tracking purchases & licenses.
              </div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setAdding(false); setTab("profile"); }}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-surface transition flex items-center gap-3 ${selectedId === r.id ? "bg-surface" : ""}`}
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-brand grid place-items-center text-[11px] font-bold text-brand-foreground shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {String(r.extra.company ?? r.extra.email ?? "—")}
                    </div>
                  </div>
                  <HealthDot score={Number(r.extra.health ?? 0)} />
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className="min-w-0">
          {adding ? (
            <ClientForm
              onCancel={() => setAdding(false)}
              onSubmit={(values) => {
                const rec = crud.create({ name: values.name, owner: "you", extra: values.extra });
                toast.success("Client created");
                setAdding(false);
                setSelectedId(rec.id);
                setTab("profile");
              }}
            />
          ) : !active ? (
            <EmptyDetail onAdd={() => setAdding(true)} />
          ) : (
            <ClientDetail
              record={active}
              tab={tab}
              setTab={setTab}
              licenses={clientLicenses}
              onPatch={(p) => crud.update(active.id, p)}
              onDelete={() => { crud.remove(active.id); setSelectedId(null); toast.success("Client removed"); }}
              onAddComment={(text) => crud.addComment(active.id, text)}
              onAddAttachment={(name, size) => crud.addAttachment(active.id, name, size)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Header({ onBack, active, onClearActive }: { onBack: () => void; active: CrudRecord | null; onClearActive: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={active ? onClearActive : onBack}
        className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> {active ? "Back to clients" : "Back to Dashboard"}
      </button>
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]">
          <UserCheck className="h-4 w-4" />
        </div>
        <div>
          <nav className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Reseller Dashboard</span><span>/</span><span className="text-foreground">Clients</span>
            {active && <><span>/</span><span className="text-foreground truncate max-w-[18ch]">{active.name}</span></>}
          </nav>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Client Management</h1>
        </div>
      </div>
    </div>
  );
}

function EmptyDetail({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center shadow-card">
      <UserCheck className="mx-auto h-8 w-8 text-muted-foreground" />
      <div className="mt-3 text-sm font-semibold">Select or create a client</div>
      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
        Pick a client from the list to see profile, purchase history, licenses, notes, documents,
        follow-up tasks and the full communication timeline.
      </p>
      <button onClick={onAdd} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
        <Plus className="h-3.5 w-3.5" /> Create your first client
      </button>
    </div>
  );
}

function ClientDetail({
  record, tab, setTab, licenses, onPatch, onDelete, onAddComment, onAddAttachment,
}: {
  record: CrudRecord;
  tab: Tab; setTab: (t: Tab) => void;
  licenses: CrudRecord[];
  onPatch: (p: Partial<CrudRecord>) => void;
  onDelete: () => void;
  onAddComment: (text: string) => void;
  onAddAttachment: (name: string, size: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* identity */}
      <div className="p-5 border-b border-border flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-brand grid place-items-center text-sm font-bold text-brand-foreground">
          {initials(record.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate">{record.name}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success border border-success/30 px-2 py-0.5 text-[10px] font-semibold">
              <Heart className="h-3 w-3" /> Health {Number(record.extra.health ?? 0)}%
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            {record.extra.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{String(record.extra.company)}</span>}
            {record.extra.email   && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{String(record.extra.email)}</span>}
            {record.extra.phone   && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{String(record.extra.phone)}</span>}
            {record.extra.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{String(record.extra.location)}</span>}
          </div>
        </div>
        <button onClick={onDelete} title="Delete client" className="grid h-9 w-9 place-items-center rounded-lg bg-surface hover:bg-danger/15 hover:text-danger border border-border transition">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 px-3 pt-3 overflow-x-auto scrollbar-thin border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition ${
              tab === t.key ? "bg-surface text-foreground border border-border border-b-transparent" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "profile"   && <ProfileTab record={record} onPatch={onPatch} />}
        {tab === "purchases" && <PurchasesTab record={record} onPatch={onPatch} />}
        {tab === "licenses"  && <LicensesTab licenses={licenses} />}
        {tab === "notes"     && <NotesTab record={record} onPatch={onPatch} />}
        {tab === "documents" && <DocsTab record={record} onAttach={onAddAttachment} />}
        {tab === "followup"  && <FollowupTab record={record} onPatch={onPatch} />}
        {tab === "timeline"  && <TimelineTab record={record} onComment={onAddComment} />}
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

function ProfileTab({ record, onPatch }: { record: CrudRecord; onPatch: (p: Partial<CrudRecord>) => void }) {
  const [draft, setDraft] = useState({
    name: record.name,
    company: String(record.extra.company ?? ""),
    email: String(record.extra.email ?? ""),
    phone: String(record.extra.phone ?? ""),
    location: String(record.extra.location ?? ""),
    health: Number(record.extra.health ?? 0),
    industry: String(record.extra.industry ?? ""),
    website: String(record.extra.website ?? ""),
  });
  function save() {
    onPatch({ name: draft.name, extra: { ...record.extra, company: draft.company, email: draft.email, phone: draft.phone, location: draft.location, health: draft.health, industry: draft.industry, website: draft.website } });
    toast.success("Profile updated");
  }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name"  value={draft.name}     onChange={(v) => setDraft({ ...draft, name: v })} />
        <Field label="Company"    value={draft.company}  onChange={(v) => setDraft({ ...draft, company: v })} />
        <Field label="Email"      value={draft.email}    onChange={(v) => setDraft({ ...draft, email: v })} type="email" />
        <Field label="Phone"      value={draft.phone}    onChange={(v) => setDraft({ ...draft, phone: v })} />
        <Field label="Industry"   value={draft.industry} onChange={(v) => setDraft({ ...draft, industry: v })} />
        <Field label="Location"   value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
        <Field label="Website"    value={draft.website}  onChange={(v) => setDraft({ ...draft, website: v })} />
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer health</label>
          <input
            type="range" min={0} max={100}
            value={draft.health}
            onChange={(e) => setDraft({ ...draft, health: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          <div className="text-xs text-muted-foreground mt-1">Score: <span className="text-foreground font-semibold">{draft.health}%</span></div>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
          <Pencil className="h-3.5 w-3.5" /> Save profile
        </button>
      </div>
    </div>
  );
}

function PurchasesTab({ record, onPatch }: { record: CrudRecord; onPatch: (p: Partial<CrudRecord>) => void }) {
  type Purchase = { id: string; product: string; amount: number; date: string; status: string };
  const purchases: Purchase[] = Array.isArray((record.extra as any).purchases) ? (record.extra as any).purchases : [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product: "", amount: 0, status: "paid" });

  function add() {
    if (!form.product.trim()) return;
    const next: Purchase[] = [{ id: rid(), product: form.product, amount: form.amount, date: new Date().toISOString(), status: form.status }, ...purchases];
    onPatch({ extra: { ...record.extra, purchases: next as any } });
    setOpen(false); setForm({ product: "", amount: 0, status: "paid" });
    toast.success("Purchase added");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{purchases.length} purchase{purchases.length === 1 ? "" : "s"}</div>
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2">
          <Plus className="h-3.5 w-3.5" /> Add purchase
        </button>
      </div>
      {open && (
        <div className="rounded-xl border border-border bg-surface p-3 grid sm:grid-cols-[1fr_140px_140px_auto] gap-2 items-end">
          <Field label="Product" value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
          <Field label="Amount"  value={String(form.amount)} onChange={(v) => setForm({ ...form, amount: Number(v) || 0 })} type="number" />
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1 w-full rounded-lg bg-surface border border-border px-2 py-2 text-xs">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <button onClick={add} className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">Save</button>
        </div>
      )}
      {purchases.length === 0 ? (
        <Empty icon={ShoppingCart} text="No purchases yet" />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface text-muted-foreground">
              <tr><th className="text-left p-2">Product</th><th className="text-left p-2">Date</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Status</th></tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-2 font-medium">{p.product}</td>
                  <td className="p-2 text-muted-foreground">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="p-2 text-right">${p.amount.toLocaleString()}</td>
                  <td className="p-2 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LicensesTab({ licenses }: { licenses: CrudRecord[] }) {
  if (licenses.length === 0) return <Empty icon={FileBadge} text="No licenses linked to this client. Go to Licenses to issue one." />;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-surface text-muted-foreground">
          <tr><th className="text-left p-2">Product</th><th className="text-left p-2">Key</th><th className="text-left p-2">Status</th><th className="text-left p-2">Expires</th></tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.id} className="border-t border-border/60">
              <td className="p-2 font-medium">{l.name}</td>
              <td className="p-2 font-mono text-[10px]">{String(l.extra.key ?? "—")}</td>
              <td className="p-2 capitalize">{l.status}</td>
              <td className="p-2 text-muted-foreground">{String(l.extra.expiry ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesTab({ record, onPatch }: { record: CrudRecord; onPatch: (p: Partial<CrudRecord>) => void }) {
  const [text, setText] = useState(record.notes);
  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="Private notes about this client — pitch context, preferences, blockers…"
        className="w-full rounded-lg bg-surface border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
      />
      <div className="flex justify-end">
        <button onClick={() => { onPatch({ notes: text }); toast.success("Notes saved"); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
          <StickyNote className="h-3.5 w-3.5" /> Save notes
        </button>
      </div>
    </div>
  );
}

function DocsTab({ record, onAttach }: { record: CrudRecord; onAttach: (name: string, size: number) => void }) {
  function upload() {
    const i = document.createElement("input");
    i.type = "file"; i.multiple = true;
    i.onchange = () => {
      const files = Array.from(i.files || []);
      files.forEach((f) => onAttach(f.name, f.size));
      if (files.length) toast.success(`${files.length} document${files.length === 1 ? "" : "s"} attached`);
    };
    i.click();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{record.attachments.length} document{record.attachments.length === 1 ? "" : "s"}</div>
        <button onClick={upload} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2">
          <Paperclip className="h-3.5 w-3.5" /> Upload
        </button>
      </div>
      {record.attachments.length === 0 ? (
        <Empty icon={FileText} text="No documents yet. Attach contracts, invoices, NDAs and onboarding kits." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {record.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</span>
              <span className="text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FollowupTab({ record, onPatch }: { record: CrudRecord; onPatch: (p: Partial<CrudRecord>) => void }) {
  type Task = { id: string; title: string; due: string; done: boolean };
  const tasks: Task[] = Array.isArray((record.extra as any).tasks) ? (record.extra as any).tasks : [];
  const [title, setTitle] = useState(""); const [due, setDue] = useState("");
  function add() {
    if (!title.trim()) return;
    const next: Task[] = [{ id: rid(), title, due: due || new Date().toISOString().slice(0,10), done: false }, ...tasks];
    onPatch({ extra: { ...record.extra, tasks: next as any } });
    setTitle(""); setDue("");
    toast.success("Follow-up scheduled");
  }
  function toggle(id: string) {
    const next = tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t);
    onPatch({ extra: { ...record.extra, tasks: next as any } });
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface p-3 grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
        <Field label="Follow-up task" value={title} onChange={setTitle} placeholder="e.g. Send renewal quote" />
        <Field label="Due date" value={due} onChange={setDue} type="date" />
        <button onClick={add} className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">Schedule</button>
      </div>
      {tasks.length === 0 ? <Empty icon={CalendarClock} text="No follow-ups scheduled." /> : (
        <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
              <span className={`flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
              <span className="text-muted-foreground">{t.due}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineTab({ record, onComment }: { record: CrudRecord; onComment: (text: string) => void }) {
  const [text, setText] = useState("");
  const merged = [
    ...record.comments.map((c) => ({ kind: "comment" as const, id: c.id, date: c.date, text: c.text, by: c.author })),
    ...record.audit.map((a) => ({ kind: "audit" as const, id: a.id, date: a.date, text: a.action, by: a.by, detail: a.detail })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Log communication</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Called, emailed, met for demo…"
            className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={() => { if (text.trim()) { onComment(text.trim()); setText(""); toast.success("Logged"); } }}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">Log</button>
      </div>
      {merged.length === 0 ? <Empty icon={Activity} text="No activity yet." /> : (
        <ol className="relative border-l border-border ml-3 space-y-3">
          {merged.map((e) => (
            <li key={e.id} className="ml-4">
              <span className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background ${e.kind === "comment" ? "bg-brand" : "bg-muted-foreground/40"}`} />
              <div className="text-xs">
                <span className="font-semibold capitalize">{e.kind === "comment" ? "Comment" : e.text}</span>
                {e.kind === "comment" && <span> · {e.text}</span>}
                {"detail" in e && e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}
              </div>
              <div className="text-[10px] text-muted-foreground">{new Date(e.date).toLocaleString()} · {e.by}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------- New client form ---------------- */

function ClientForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (v: { name: string; extra: Record<string, string | number> }) => void }) {
  const [v, setV] = useState({ name: "", company: "", email: "", phone: "", location: "", industry: "", health: 80 });
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-5 space-y-4">
      <h2 className="text-lg font-bold">New client</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name *" value={v.name}     onChange={(x) => setV({ ...v, name: x })} />
        <Field label="Company"     value={v.company}  onChange={(x) => setV({ ...v, company: x })} />
        <Field label="Email"       value={v.email}    onChange={(x) => setV({ ...v, email: x })} type="email" />
        <Field label="Phone"       value={v.phone}    onChange={(x) => setV({ ...v, phone: x })} />
        <Field label="Industry"    value={v.industry} onChange={(x) => setV({ ...v, industry: x })} />
        <Field label="Location"    value={v.location} onChange={(x) => setV({ ...v, location: x })} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2">Cancel</button>
        <button
          disabled={!v.name.trim()}
          onClick={() => onSubmit({ name: v.name.trim(), extra: { company: v.company, email: v.email, phone: v.phone, location: v.location, industry: v.industry, health: v.health } })}
          className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
        >Create client</button>
      </div>
    </div>
  );
}

/* ---------------- Utils ---------------- */

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
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
function HealthDot({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-success" : score >= 40 ? "bg-warning" : score === 0 ? "bg-muted-foreground/30" : "bg-danger";
  return <span title={score ? `Health ${score}%` : "No health score"} className={`h-2 w-2 rounded-full ${tone}`} />;
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
function rid() { return Math.random().toString(36).slice(2, 9); }
// silence
void Inbox; void Star;
