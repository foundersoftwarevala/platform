import { useMemo, useState } from "react";
import {
  ArrowLeft, Building2, Calculator, Check, Download, Pencil, Plus, Star, Trash2, Upload, X,
} from "lucide-react";
import { BarChart, DonutChart, LineChart, Sparkline } from "@/components/charts/Charts";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import {
  DAYS, LEAD_STAGES, MONTHS, useFranchise,
  type Branch, type Employee, type Lead, type LeadStage,
} from "@/lib/franchise-store";
import { fmtMoney } from "@/lib/metrics";

export const FRANCHISE_MODULES = ["branches", "leads", "revenue", "employees"] as const;
export function isFranchiseModule(key: string) {
  return (FRANCHISE_MODULES as readonly string[]).includes(key);
}

function Shell({ title, subtitle, onBack, actions, children }: {
  title: string; subtitle: string; onBack: () => void; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 ams-cascade">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:border-brand/60">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight truncate">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/50";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 depth-3d">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="press-3d grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------- Branches ---------------------------- */

function BranchesModule({ onBack }: { onBack: () => void }) {
  const { branches, createBranch, updateBranch, removeBranches } = useFranchise();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", city: "", region: "West", manager: "", target: 250000 });

  const columns: Column<Branch>[] = [
    { key: "name", label: "Branch", sortValue: (b) => b.name, render: (b) => (
      <button onClick={() => setDetail(b)} className="text-left font-medium hover:text-brand">{b.name}<div className="text-[11px] text-muted-foreground">{b.id}</div></button>
    ) },
    { key: "city", label: "City", sortValue: (b) => b.city, render: (b) => <span>{b.city} <span className="text-muted-foreground">• {b.region}</span></span> },
    { key: "manager", label: "Manager", sortValue: (b) => b.manager, render: (b) => b.manager, hideOnMobile: true },
    { key: "status", label: "Status", sortValue: (b) => b.status, render: (b) => (
      <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${
        b.status === "active" ? "bg-success/15 text-success" : b.status === "paused" || b.status === "closed" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
      }`}>{b.status}</span>
    ) },
    { key: "revenue", label: "Revenue", sortValue: (b) => b.monthlyRevenue, render: (b) => <span className="font-semibold">{fmtMoney(b.monthlyRevenue)}</span> },
    { key: "trend", label: "Trend", render: (b) => <Sparkline values={b.trend} color="oklch(0.72 0.2 265)" w={70} h={22} />, hideOnMobile: true },
    { key: "rating", label: "Rating", sortValue: (b) => b.rating, render: (b) => (
      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-warning" />{b.rating}</span>
    ) },
  ];

  function submit() {
    if (editing) updateBranch(editing.id, { ...form });
    else createBranch({ ...form });
    setEditing(null); setCreating(false);
  }

  return (
    <Shell
      title="Branches" subtitle={`${branches.length} locations in the network`} onBack={onBack}
      actions={
        <button
          onClick={() => { setForm({ name: "", city: "", region: "West", manager: "", target: 250000 }); setCreating(true); }}
          className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
        ><Plus className="h-3.5 w-3.5" /> New branch</button>
      }
    >
      <DataTable
        rows={branches}
        columns={columns}
        searchKeys={(b) => `${b.name} ${b.city} ${b.region} ${b.manager} ${b.id}`}
        filters={[{ label: "Active", value: "active" }, { label: "Onboarding", value: "onboarding" }, { label: "Paused", value: "paused" }]}
        actions={[
          { label: "Edit", icon: <Pencil className="h-3.5 w-3.5" />, onClick: (b) => { setEditing(b); setForm({ name: b.name, city: b.city, region: b.region, manager: b.manager, target: b.target }); } },
          { label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "danger", onClick: (b) => removeBranches([b.id]) },
        ]}
        bulkActions={[{ label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "danger", onClick: removeBranches }]}
        emptyLabel="No branches match your filters"
      />

      {(creating || editing) && (
        <Modal title={editing ? `Edit ${editing.name}` : "New branch"} onClose={() => { setCreating(false); setEditing(null); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Branch name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Region">
              <select className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                {["West", "North", "South", "East", "Central"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Manager"><input className={inputCls} value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} /></Field>
            <Field label="Monthly target"><input type="number" className={inputCls} value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => { setCreating(false); setEditing(null); }} className="press-3d rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button onClick={submit} className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
              <Check className="h-3.5 w-3.5" /> {editing ? "Save changes" : "Create branch"}
            </button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">ID</span><div className="font-medium">{detail.id}</div></div>
            <div><span className="text-muted-foreground">Manager</span><div className="font-medium">{detail.manager}</div></div>
            <div><span className="text-muted-foreground">Opened</span><div className="font-medium">{new Date(detail.openedAt).toLocaleDateString()}</div></div>
            <div><span className="text-muted-foreground">Employees</span><div className="font-medium">{detail.employees}</div></div>
            <div><span className="text-muted-foreground">Revenue</span><div className="font-medium">{fmtMoney(detail.monthlyRevenue)}</div></div>
            <div><span className="text-muted-foreground">Target</span><div className="font-medium">{fmtMoney(detail.target)}</div></div>
          </div>
          <div className="mt-3">
            <LineChart height={150} format={(v) => fmtMoney(v * 900)} data={detail.trend.map((v, i) => ({ label: MONTHS[i], value: v }))} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => { setEditing(detail); setForm({ name: detail.name, city: detail.city, region: detail.region, manager: detail.manager, target: detail.target }); setDetail(null); }}
              className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"
            ><Pencil className="h-3.5 w-3.5" /> Edit branch</button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

/* ---------------------------- Leads pipeline ---------------------------- */

const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", won: "Won", lost: "Lost",
};

function LeadsModule({ onBack }: { onBack: () => void }) {
  const { leads, createLead, updateLead, removeLead } = useFranchise();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"board" | "table">("board");
  const [form, setForm] = useState({ name: "", company: "", city: "", owner: "", value: 0, source: "Website", stage: "new" as LeadStage });

  const grouped = useMemo(
    () => LEAD_STAGES.map((s) => ({ stage: s, items: leads.filter((l) => l.stage === s) })),
    [leads],
  );
  const won = leads.filter((l) => l.stage === "won");
  const conversion = leads.length ? Math.round((won.length / leads.length) * 100) : 0;

  const columns: Column<Lead>[] = [
    { key: "name", label: "Lead", sortValue: (l) => l.name, render: (l) => (
      <button onClick={() => setDetail(l)} className="text-left font-medium hover:text-brand">{l.name}<div className="text-[11px] text-muted-foreground">{l.company}</div></button>
    ) },
    { key: "stage", label: "Stage", sortValue: (l) => l.stage, render: (l) => <span className="capitalize">{STAGE_LABEL[l.stage]}</span> },
    { key: "value", label: "Value", sortValue: (l) => l.value, render: (l) => fmtMoney(l.value) },
    { key: "owner", label: "Owner", sortValue: (l) => l.owner, render: (l) => l.owner, hideOnMobile: true },
    { key: "source", label: "Source", sortValue: (l) => l.source, render: (l) => l.source, hideOnMobile: true },
  ];

  return (
    <Shell
      title="Leads pipeline" subtitle={`${leads.length} leads • ${conversion}% conversion`} onBack={onBack}
      actions={
        <>
          <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs">
            {(["board", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1.5 capitalize ${view === v ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => setCreating(true)} className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
            <Plus className="h-3.5 w-3.5" /> New lead
          </button>
        </>
      }
    >
      {view === "board" ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {grouped.map(({ stage, items }) => (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => { if (dragId) updateLead(dragId, { stage }); setDragId(null); setOverStage(null); }}
              className={`rounded-2xl border bg-card p-2.5 depth-3d transition ${overStage === stage ? "border-brand" : "border-border"}`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold">{STAGE_LABEL[stage]}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab active:cursor-grabbing rounded-xl border border-border bg-background p-2.5 sheen-3d transition hover:border-brand/60 ${dragId === l.id ? "opacity-50" : ""}`}
                  >
                    <button onClick={() => setDetail(l)} className="w-full text-left">
                      <div className="truncate text-xs font-semibold">{l.company}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{l.name} • {l.city}</div>
                      <div className="mt-1 text-xs font-bold text-brand">{fmtMoney(l.value)}</div>
                    </button>
                  </div>
                ))}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">Drop here</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          rows={leads} columns={columns}
          searchKeys={(l) => `${l.name} ${l.company} ${l.city} ${l.owner} ${l.source}`}
          filters={LEAD_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: s }))}
          actions={[{ label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "danger", onClick: (l) => removeLead(l.id) }]}
          emptyLabel="No leads match your filters"
        />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Pipeline value by stage</div>
          <div className="mt-2">
            <BarChart
              height={160} format={fmtMoney}
              data={grouped.map(({ stage, items }) => ({ label: STAGE_LABEL[stage].slice(0, 4), value: items.reduce((s, l) => s + l.value, 0) }))}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Lead sources</div>
          <div className="mt-2">
            <DonutChart
              size={180} format={(v) => `${v} leads`}
              data={Object.entries(leads.reduce<Record<string, number>>((a, l) => { a[l.source] = (a[l.source] ?? 0) + 1; return a; }, {})).map(([label, value]) => ({ label, value }))}
            />
          </div>
        </div>
      </div>

      {creating && (
        <Modal title="New lead" onClose={() => setCreating(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Company"><input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Owner"><input className={inputCls} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
            <Field label="Deal value"><input type="number" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
            <Field label="Stage">
              <select className={inputCls} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
                {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="press-3d rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button
              onClick={() => { createLead(form); setCreating(false); setForm({ name: "", company: "", city: "", owner: "", value: 0, source: "Website", stage: "new" }); }}
              className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
            ><Check className="h-3.5 w-3.5" /> Create lead</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.company} onClose={() => setDetail(null)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Contact</span><div className="font-medium">{detail.name}</div></div>
            <div><span className="text-muted-foreground">Owner</span><div className="font-medium">{detail.owner}</div></div>
            <div><span className="text-muted-foreground">Value</span><div className="font-medium">{fmtMoney(detail.value)}</div></div>
            <div><span className="text-muted-foreground">Source</span><div className="font-medium">{detail.source}</div></div>
            <div><span className="text-muted-foreground">Created</span><div className="font-medium">{new Date(detail.createdAt).toLocaleDateString()}</div></div>
          </div>
          <Field label="Move to stage">
            <select
              className={inputCls} value={detail.stage}
              onChange={(e) => { const stage = e.target.value as LeadStage; updateLead(detail.id, { stage }); setDetail({ ...detail, stage }); }}
            >
              {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              className={`${inputCls} min-h-20`} value={detail.notes}
              onChange={(e) => { updateLead(detail.id, { notes: e.target.value }); setDetail({ ...detail, notes: e.target.value }); }}
            />
          </Field>
          <div className="mt-3 flex justify-end">
            <button onClick={() => { removeLead(detail.id); setDetail(null); }} className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete lead
            </button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

/* ---------------------------- Revenue ---------------------------- */

function RevenueModule({ onBack }: { onBack: () => void }) {
  const { branches, payments } = useFranchise();
  const [rate, setRate] = useState(12);
  const [base, setBase] = useState(500_000);
  const [growth, setGrowth] = useState(6);

  const monthly = MONTHS.map((m, i) => ({ label: m, value: branches.reduce((s, b) => s + (b.trend[i] ?? 0), 0) * 900 }));
  const total = branches.reduce((s, b) => s + b.monthlyRevenue, 0);
  const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const outstanding = payments.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
  const forecast = Array.from({ length: 6 }, (_, i) => ({
    label: `M+${i + 1}`,
    value: Math.round(total * Math.pow(1 + growth / 100, i + 1)),
  }));

  const stats = [
    { label: "Monthly run-rate", value: fmtMoney(total) },
    { label: "Collected", value: fmtMoney(collected) },
    { label: "Outstanding", value: fmtMoney(outstanding) },
    { label: "Commission pool", value: fmtMoney(total * (rate / 100)) },
  ];

  function exportCsv() {
    const csv = ["branch,city,region,monthly_revenue,target,status", ...branches.map((b) => `${b.name},${b.city},${b.region},${b.monthlyRevenue},${b.target},${b.status}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "franchise-revenue.csv";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  return (
    <Shell
      title="Revenue" subtitle="Trends, breakdown, forecast and commission" onBack={onBack}
      actions={
        <button onClick={exportCsv} className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:border-brand/60">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      }
    >
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 depth-3d">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-xl font-black tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Revenue trend</div>
          <div className="mt-2"><LineChart data={monthly} height={210} format={fmtMoney} /></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Top branches</div>
          <div className="mt-2">
            <BarChart
              horizontal height={210} format={fmtMoney}
              data={[...branches].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).slice(0, 6).map((b) => ({ label: b.city, value: b.monthlyRevenue }))}
            />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Forecast</div>
          <Field label={`Assumed monthly growth: ${growth}%`}>
            <input type="range" min={0} max={20} value={growth} onChange={(e) => setGrowth(Number(e.target.value))} className="mt-1 w-full accent-[oklch(0.62_0.22_265)]" />
          </Field>
          <div className="mt-2"><BarChart data={forecast} height={170} format={fmtMoney} /></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="flex items-center gap-2 text-sm font-semibold"><Calculator className="h-4 w-4 text-brand" /> Commission calculator</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Base revenue"><input type="number" className={inputCls} value={base} onChange={(e) => setBase(Number(e.target.value))} /></Field>
            <Field label="Commission rate %"><input type="number" className={inputCls} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
          </div>
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <div className="text-xs text-muted-foreground">Payout</div>
            <div className="text-2xl font-black tracking-tight text-brand">{fmtMoney(base * (rate / 100))}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Net to franchisor {fmtMoney(base - base * (rate / 100))}</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------------------- Employees ---------------------------- */

function EmployeesModule({ onBack }: { onBack: () => void }) {
  const { employees, branches, createEmployee, updateEmployee, removeEmployees, importEmployees } = useFranchise();
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: "", role: "Sales Executive", branch: "", email: "", performance: 60 });

  const columns: Column<Employee>[] = [
    { key: "name", label: "Employee", sortValue: (e) => e.name, render: (e) => (
      <button onClick={() => setDetail(e)} className="text-left font-medium hover:text-brand">{e.name}<div className="text-[11px] text-muted-foreground">{e.role}</div></button>
    ) },
    { key: "branch", label: "Branch", sortValue: (e) => e.branch, render: (e) => e.branch },
    { key: "status", label: "Status", sortValue: (e) => e.status, render: (e) => (
      <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${
        e.status === "active" ? "bg-success/15 text-success" : e.status === "exited" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
      }`}>{e.status}</span>
    ) },
    { key: "performance", label: "Performance", sortValue: (e) => e.performance, render: (e) => (
      <div className="min-w-24">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${e.performance > 75 ? "bg-success" : e.performance > 55 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${e.performance}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{e.performance}%</span>
      </div>
    ) },
    { key: "joined", label: "Joined", sortValue: (e) => e.joinedAt, render: (e) => new Date(e.joinedAt).toLocaleDateString(), hideOnMobile: true },
  ];

  function onImport(file: File) {
    file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed)) importEmployees(parsed);
      } catch { /* ignore malformed file */ }
    });
  }

  return (
    <Shell
      title="Employees" subtitle={`${employees.length} people • ${employees.filter((e) => e.status === "active").length} active`} onBack={onBack}
      actions={
        <>
          <label className="press-3d inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:border-brand/60">
            <Upload className="h-3.5 w-3.5" /> Import
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          </label>
          <button onClick={() => setCreating(true)} className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
            <Plus className="h-3.5 w-3.5" /> Hire
          </button>
        </>
      }
    >
      <DataTable
        rows={employees} columns={columns}
        searchKeys={(e) => `${e.name} ${e.role} ${e.branch} ${e.email}`}
        filters={[{ label: "Active", value: "active" }, { label: "Probation", value: "probation" }, { label: "Leave", value: "leave" }]}
        actions={[{ label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "danger", onClick: (e) => removeEmployees([e.id]) }]}
        bulkActions={[{ label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, tone: "danger", onClick: removeEmployees }]}
        emptyLabel="No employees match your filters"
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Headcount by branch</div>
          <div className="mt-2">
            <BarChart
              horizontal height={200} format={(v) => `${v}`}
              data={branches.slice(0, 8).map((b) => ({ label: b.city, value: employees.filter((e) => e.branch === b.name).length }))}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 depth-3d">
          <div className="text-sm font-semibold">Roles distribution</div>
          <div className="mt-2">
            <DonutChart
              size={190} format={(v) => `${v} people`}
              data={Object.entries(employees.reduce<Record<string, number>>((a, e) => { a[e.role] = (a[e.role] ?? 0) + 1; return a; }, {})).map(([label, value]) => ({ label, value }))}
            />
          </div>
        </div>
      </div>

      {creating && (
        <Modal title="Hire employee" onClose={() => setCreating(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {["Branch Manager", "Sales Executive", "Support Agent", "Trainer", "Operations Lead", "Accountant"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select className={inputCls} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="press-3d rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button
              onClick={() => { createEmployee(form); setCreating(false); setForm({ name: "", role: "Sales Executive", branch: "", email: "", performance: 60 }); }}
              className="press-3d inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
            ><Check className="h-3.5 w-3.5" /> Add employee</button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Role</span><div className="font-medium">{detail.role}</div></div>
            <div><span className="text-muted-foreground">Branch</span><div className="font-medium inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{detail.branch}</div></div>
            <div><span className="text-muted-foreground">Email</span><div className="font-medium break-all">{detail.email || "—"}</div></div>
            <div><span className="text-muted-foreground">Joined</span><div className="font-medium">{new Date(detail.joinedAt).toLocaleDateString()}</div></div>
          </div>
          <Field label={`Performance: ${detail.performance}%`}>
            <input
              type="range" min={0} max={100} value={detail.performance}
              onChange={(e) => { const performance = Number(e.target.value); updateEmployee(detail.id, { performance }); setDetail({ ...detail, performance }); }}
              className="mt-1 w-full accent-[oklch(0.62_0.22_265)]"
            />
          </Field>
          <div className="mt-2">
            <div className="text-[11px] text-muted-foreground">Weekly availability</div>
            <div className="mt-1 flex gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => {
                    const availability = detail.availability.map((v, idx) => (idx === i ? !v : v));
                    updateEmployee(detail.id, { availability });
                    setDetail({ ...detail, availability });
                  }}
                  className={`press-3d rounded-lg border px-2 py-1 text-[10px] ${detail.availability[i] ? "border-transparent bg-success/20 text-success" : "border-border text-muted-foreground"}`}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => { updateEmployee(detail.id, { status: detail.status === "active" ? "leave" : "active" }); setDetail({ ...detail, status: detail.status === "active" ? "leave" : "active" }); }}
              className="press-3d rounded-lg border border-border px-3 py-1.5 text-xs"
            >{detail.status === "active" ? "Mark on leave" : "Mark active"}</button>
            <button onClick={() => { removeEmployees([detail.id]); setDetail(null); }} className="press-3d inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

export function FranchiseModulePage({ moduleKey, onBack }: { moduleKey: string; onBack: () => void }) {
  if (moduleKey === "branches") return <BranchesModule onBack={onBack} />;
  if (moduleKey === "leads") return <LeadsModule onBack={onBack} />;
  if (moduleKey === "revenue") return <RevenueModule onBack={onBack} />;
  return <EmployeesModule onBack={onBack} />;
}