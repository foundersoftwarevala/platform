import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, LifeBuoy, AlertTriangle, Hourglass, CheckCircle2,
  XCircle, MessageSquare, Send, Paperclip, History, Brain, Sparkles,
  ShieldCheck, Bug, Download, Upload, Settings as SettingsIcon,
  RefreshCcw, Wrench, CreditCard, FileText, Inbox, Trash2,
} from "lucide-react";
import type { RoleConfig } from "@/lib/roles";
import { useCrud, type CrudRecord } from "@/lib/crud-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/dashboard/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Status =
  | "new" | "assigned" | "under-review" | "in-progress"
  | "waiting-customer" | "waiting-developer" | "waiting-qa"
  | "testing" | "resolved" | "closed" | "reopened";

type Priority = "low" | "medium" | "high" | "critical";

const CATEGORIES = [
  { key:"bug",           label:"Bug",            icon:Bug },
  { key:"installation",  label:"Installation",   icon:Download },
  { key:"activation",    label:"Activation",     icon:ShieldCheck },
  { key:"configuration", label:"Configuration",  icon:SettingsIcon },
  { key:"update",        label:"Update",         icon:RefreshCcw },
  { key:"customization", label:"Customization",  icon:Wrench },
  { key:"tech",          label:"Technical Support", icon:LifeBuoy },
  { key:"payment",       label:"Payment",        icon:CreditCard },
  { key:"other",         label:"Other",          icon:FileText },
];

const STATUSES: { key: Status; label: string; tone: string }[] = [
  { key:"new",               label:"New",               tone:"bg-surface-2 text-muted-foreground" },
  { key:"assigned",          label:"Assigned",          tone:"bg-brand/15 text-brand" },
  { key:"under-review",      label:"Under Review",      tone:"bg-[oklch(0.78_0.16_210)]/15 text-[oklch(0.78_0.16_210)]" },
  { key:"in-progress",       label:"In Progress",       tone:"bg-warning/15 text-warning" },
  { key:"waiting-customer",  label:"Waiting Customer",  tone:"bg-warning/15 text-warning" },
  { key:"waiting-developer", label:"Waiting Developer", tone:"bg-warning/15 text-warning" },
  { key:"waiting-qa",        label:"Waiting QA",        tone:"bg-warning/15 text-warning" },
  { key:"testing",           label:"Testing",           tone:"bg-[oklch(0.78_0.18_300)]/15 text-[oklch(0.78_0.18_300)]" },
  { key:"resolved",          label:"Resolved",          tone:"bg-success/15 text-success" },
  { key:"closed",            label:"Closed",            tone:"bg-surface-2 text-muted-foreground" },
  { key:"reopened",          label:"Reopened",          tone:"bg-danger/15 text-danger" },
];

const PRIORITY_TONE: Record<Priority, string> = {
  low:      "bg-surface-2 text-muted-foreground",
  medium:   "bg-[oklch(0.78_0.16_210)]/15 text-[oklch(0.78_0.16_210)]",
  high:     "bg-warning/15 text-warning",
  critical: "bg-danger/15 text-danger",
};

function genAmsId() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `AMS-${n}`;
}

function statusOf(r: CrudRecord): Status {
  return (String(r.extra.status ?? "new") as Status);
}
function priorityOf(r: CrudRecord): Priority {
  return (String(r.extra.priority ?? "medium") as Priority);
}

export function AMSWorkspace({ role, onBack }: { role: RoleConfig; onBack: () => void }) {
  const crud = useCrud(role.key, "ams");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? crud.records.find(r => r.id === activeId) ?? null : null;

  const counts = useMemo(() => {
    const out = { open: 0, pending: 0, resolved: 0, closed: 0, critical: 0 };
    for (const r of crud.records) {
      const s = statusOf(r);
      const p = priorityOf(r);
      if (p === "critical") out.critical++;
      if (s === "closed") out.closed++;
      else if (s === "resolved") out.resolved++;
      else if (s.startsWith("waiting")) out.pending++;
      else out.open++;
    }
    return out;
  }, [crud.records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return crud.records;
    return crud.records.filter(r =>
      [r.name, String(r.extra.amsId ?? ""), String(r.extra.product ?? ""), String(r.extra.category ?? "")]
        .some(s => s.toLowerCase().includes(q))
    );
  }, [crud.records, query]);

  if (active) {
    return (
      <AMSDetail
        record={active}
        onBack={() => setActiveId(null)}
        onUpdate={(patch) => crud.update(active.id, patch)}
        onComment={(text) => crud.addComment(active.id, text)}
        onDelete={() => { crud.remove(active.id); setActiveId(null); toast.success("AMS deleted."); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{role.name} • After Sales Management</div>
          <h1 className="text-xl md:text-2xl font-semibold">AMS — Support Requests</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <CountCard icon={Inbox}        label="Open"      value={counts.open}     tone="brand" />
        <CountCard icon={Hourglass}    label="Pending"   value={counts.pending}  tone="warning" />
        <CountCard icon={CheckCircle2} label="Resolved"  value={counts.resolved} tone="success" />
        <CountCard icon={XCircle}      label="Closed"    value={counts.closed}   tone="cyan" />
        <CountCard icon={AlertTriangle} label="Critical" value={counts.critical} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search AMS ID, product, category…" className="pl-9" />
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New AMS</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground" />
          <div className="mt-3 font-medium">No support requests yet</div>
          <div className="text-sm text-muted-foreground">Create an AMS to start tracking issues.</div>
          <Button className="mt-4" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> New AMS</Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface-1 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">AMS ID</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Product</th>
                <th className="text-left px-4 py-2">Category</th>
                <th className="text-left px-4 py-2">Priority</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-2 cursor-pointer" onClick={() => setActiveId(r.id)}>
                  <td className="px-4 py-3 font-mono text-xs">{String(r.extra.amsId ?? "—")}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{String(r.extra.product ?? "—")}</td>
                  <td className="px-4 py-3">{String(r.extra.category ?? "—")}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", PRIORITY_TONE[priorityOf(r)])}>
                      {priorityOf(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={statusOf(r)} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateAMS
          onClose={() => setCreating(false)}
          onCreate={(input) => {
            const amsId = genAmsId();
            const rec = crud.create({
              name: input.title,
              status: "pending",
              category: input.category,
              notes: input.description,
              extra: {
                amsId,
                product: input.product,
                category: input.category,
                priority: input.priority,
                status: "new",
                expected: input.expected,
                notesExtra: input.notesExtra,
                department: "Support",
              },
            });
            setCreating(false);
            setActiveId(rec.id);
            toast.success(`Created ${amsId}`);
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const s = STATUSES.find(x => x.key === status) ?? STATUSES[0];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", s.tone)}>{s.label}</span>;
}

function CountCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const toneCls: Record<string,string> = {
    brand:"text-brand bg-brand/15", success:"text-success bg-success/15",
    warning:"text-warning bg-warning/15", danger:"text-danger bg-danger/15",
    cyan:"text-[oklch(0.78_0.16_210)] bg-[oklch(0.78_0.16_210)]/15",
  };
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", toneCls[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// ─────────────────────────────── CREATE ───────────────────────────────

function CreateAMS({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { title: string; description: string; product: string; category: string; priority: Priority; expected: string; notesExtra: string }) => void;
}) {
  const [step, setStep] = useState<1|2|3>(1);
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState<string>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [expected, setExpected] = useState("");
  const [notesExtra, setNotesExtra] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">New AMS — Step {step} of 3</div>
            <div className="font-semibold">Create Support Request</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {step === 1 && (
            <>
              <Labelled label="Product">
                <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Software Vala CRM Pro" />
              </Labelled>
              <Labelled label="Category">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition",
                        category === c.key ? "border-brand bg-brand/10 text-foreground" : "border-border bg-surface-1 hover:bg-surface-2")}>
                      <c.icon className="h-4 w-4" /> {c.label}
                    </button>
                  ))}
                </div>
              </Labelled>
            </>
          )}

          {step === 2 && (
            <>
              <Labelled label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary of the issue" />
              </Labelled>
              <Labelled label="Description">
                <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? Steps to reproduce…" />
              </Labelled>
              <Labelled label="Priority">
                <div className="flex flex-wrap gap-2">
                  {(["low","medium","high","critical"] as Priority[]).map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={cn("px-3 py-1.5 rounded-full text-xs border transition capitalize",
                        priority === p ? "bg-brand text-brand-foreground border-brand" : "border-border bg-surface-1 hover:bg-surface-2")}>
                      {p}
                    </button>
                  ))}
                </div>
              </Labelled>
              <Labelled label="Expected Result">
                <Input value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="What should happen instead?" />
              </Labelled>
              <Labelled label="Additional Notes">
                <Textarea rows={2} value={notesExtra} onChange={(e) => setNotesExtra(e.target.value)} placeholder="Anything else our team should know…" />
              </Labelled>
            </>
          )}

          {step === 3 && (
            <div className="rounded-xl border border-border bg-surface-1 p-4 text-sm space-y-2">
              <Row k="Product" v={product || "—"} />
              <Row k="Category" v={CATEGORIES.find(c => c.key === category)?.label ?? category} />
              <Row k="Title" v={title || "—"} />
              <Row k="Priority" v={priority} />
              <Row k="Expected" v={expected || "—"} />
              <p className="text-xs text-muted-foreground pt-2">
                Submitting will generate an AMS ID, assign to Support, and create the ticket activity timeline.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => (s - 1) as 1|2|3)}>Back</Button>
          {step < 3 ? (
            <Button
              disabled={step === 1 ? !product.trim() : !title.trim()}
              onClick={() => setStep((s) => (s + 1) as 1|2|3)}
            >
              Next
            </Button>
          ) : (
            <Button onClick={() => onCreate({ title, description, product, category, priority, expected, notesExtra })}>
              Submit AMS
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}

// ─────────────────────────────── DETAIL ───────────────────────────────

function AMSDetail({
  record, onBack, onUpdate, onComment, onDelete,
}: {
  record: CrudRecord;
  onBack: () => void;
  onUpdate: (patch: Partial<CrudRecord>) => void;
  onComment: (text: string) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"chat"|"details"|"ai"|"history">("chat");
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"support"|"developer"|"qa"|"boss"|"ai">("support");
  const status = statusOf(record);
  const priority = priorityOf(record);

  function setStatus(s: Status) {
    onUpdate({ extra: { ...record.extra, status: s } });
    toast.success(`Status → ${s}`);
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    onComment(`[${channel}] ${text}`);
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" /> Back to AMS list
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Reopened.")}><RefreshCcw className="h-4 w-4 mr-1" />Reopen</Button>
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface-1 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-mono">{String(record.extra.amsId ?? record.id)}</div>
            <div className="text-lg font-semibold">{record.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-surface-2 px-2 py-0.5">{String(record.extra.product ?? "—")}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5">{String(record.extra.category ?? "—")}</span>
              <span className={cn("rounded-full px-2 py-0.5", PRIORITY_TONE[priority])}>{priority}</span>
              <StatusPill status={status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.slice(0,8).map((s) => (
              <button key={s.key} onClick={() => setStatus(s.key)}
                className={cn("text-[10px] px-2 py-1 rounded-full border transition",
                  status === s.key ? "border-brand bg-brand/10" : "border-border bg-surface-1 hover:bg-surface-2")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-surface-2">
          <TabsTrigger value="chat"><MessageSquare className="h-3.5 w-3.5 mr-1" />Chat</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="ai"><Brain className="h-3.5 w-3.5 mr-1" />AI</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="rounded-2xl border border-border bg-surface-1 flex flex-col h-[460px]">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto">
              {(["support","developer","qa","boss","ai"] as const).map((c) => (
                <button key={c} onClick={() => setChannel(c)}
                  className={cn("text-xs px-3 py-1 rounded-full capitalize transition",
                    channel === c ? "bg-brand text-brand-foreground" : "bg-surface-2 text-muted-foreground hover:text-foreground")}>
                  {c === "ai" ? "AI Assistant" : c}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {record.comments.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground pt-12">
                  No messages yet. Start the conversation with the {channel} team.
                </div>
              ) : record.comments.map((c) => (
                <div key={c.id} className="max-w-[80%] rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.author} • {new Date(c.date).toLocaleTimeString()}</div>
                  <div>{c.text}</div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-border flex items-end gap-2">
              <Button variant="outline" size="icon" onClick={() => toast.success("Attachment picker (UI).")}><Paperclip className="h-4 w-4" /></Button>
              <Textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${channel === "ai" ? "AI Assistant" : channel}…`}
                className="resize-none min-h-[40px]"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <Button onClick={send} disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details">
          <div className="rounded-2xl border border-border bg-surface-1 p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Detail k="AMS ID"        v={String(record.extra.amsId ?? "—")} />
            <Detail k="Product"       v={String(record.extra.product ?? "—")} />
            <Detail k="Category"      v={String(record.extra.category ?? "—")} />
            <Detail k="Priority"      v={priority} />
            <Detail k="Status"        v={status} />
            <Detail k="Assigned Team" v={String(record.extra.department ?? "Support")} />
            <Detail k="Created"       v={new Date(record.date).toLocaleString()} />
            <Detail k="Last Updated"  v={record.audit[0] ? new Date(record.audit[0].date).toLocaleString() : "—"} />
            <Detail k="Expected"      v={String(record.extra.expected ?? "—")} />
            <div className="md:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Description</div>
              <div className="rounded-lg bg-surface-2 px-3 py-2 whitespace-pre-wrap">{record.notes || "—"}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="rounded-2xl border border-border bg-surface-1 p-5 space-y-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2"><Brain className="h-4 w-4" /> AMS AI</div>
            <AIBlock title="Issue Summary"      body="AI-generated summary will appear here." />
            <AIBlock title="Suggested Solution" body="AI-suggested resolution steps will appear here." />
            <AIBlock title="Knowledge Base"     body="Relevant KB articles will be surfaced here." />
            <AIBlock title="Similar Issues"     body="Past tickets with matching patterns will be listed." />
            <AIBlock title="Smart Reply Suggestions" body="One-click replies will be suggested here." />
            <div className="rounded-xl border border-dashed border-border bg-surface-2 p-3 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 inline mr-1" /> AI execution is a placeholder — backend not connected.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-2xl border border-border bg-surface-1 divide-y divide-border">
            {record.audit.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No history yet.</div>
            ) : record.audit.map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm flex items-center gap-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium capitalize">{a.action}</div>
                  {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(a.date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium capitalize">{v}</div>
    </div>
  );
}

function AIBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}
