import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, FileBadge, KeyRound, Activity, RotateCcw, ArrowUp,
  ArrowLeftRight, PauseCircle, XCircle, MonitorSmartphone, History, Trash2,
  Copy, Inbox, ListChecks, Hourglass, Check, AlertTriangle,
} from "lucide-react";
import { useCrud, type CrudRecord, type RecordStatus } from "@/lib/crud-store";

type Tab = "overview" | "devices" | "history";
type LicState = "active" | "trial" | "expired" | "suspended";

export function ResellerLicensesWorkspace({ onBack }: { onBack: () => void }) {
  const licenses = useCrud("reseller", "licenses");
  const clients  = useCrud("reseller", "clients");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | LicState>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const stats = useMemo(() => {
    const c = { total: licenses.records.length, active: 0, trial: 0, expired: 0, suspended: 0 };
    for (const r of licenses.records) {
      const s = String(r.extra.state ?? "active") as LicState;
      if (s in c) (c as any)[s]++;
    }
    return c;
  }, [licenses.records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return licenses.records.filter((r) => {
      if (stateFilter !== "all" && String(r.extra.state ?? "active") !== stateFilter) return false;
      if (!q) return true;
      return [r.name, String(r.extra.key ?? ""), String(r.extra.clientName ?? "")]
        .some((s) => s.toLowerCase().includes(q));
    });
  }, [licenses.records, query, stateFilter]);

  const active = activeId ? licenses.records.find((r) => r.id === activeId) : null;

  function changeState(id: string, state: LicState, action: string) {
    const rec = licenses.records.find((r) => r.id === id);
    if (!rec) return;
    const history: any[] = Array.isArray((rec.extra as any).history) ? (rec.extra as any).history : [];
    licenses.update(id, {
      status: (state === "active" || state === "trial" ? "active" : state === "expired" ? "rejected" : "archived") as RecordStatus,
      extra: {
        ...rec.extra,
        state,
        history: [{ id: rid(), action, date: new Date().toISOString() }, ...history] as any,
      },
    });
    toast.success(`License ${action}`);
  }

  function deleteLicense(id: string) {
    licenses.remove(id);
    if (activeId === id) setActiveId(null);
    toast.success("License removed");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <button onClick={active ? () => setActiveId(null) : onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {active ? "Back to licenses" : "Back to Dashboard"}
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]"><FileBadge className="h-4 w-4" /></div>
          <div>
            <nav className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>Reseller Dashboard</span><span>/</span><span className="text-foreground">Licenses</span>
              {active && <><span>/</span><span className="text-foreground truncate max-w-[18ch]">{active.name}</span></>}
            </nav>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">License Management</h1>
          </div>
        </div>
        <button onClick={() => setGenerating(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
          <KeyRound className="h-3.5 w-3.5" /> Generate License
        </button>
      </header>

      {!active && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Total"     value={stats.total}     icon={ListChecks} tone="brand" />
            <Stat label="Active"    value={stats.active}    icon={Check}      tone="success" />
            <Stat label="Trial"     value={stats.trial}     icon={Hourglass}  tone="cyan" />
            <Stat label="Expired"   value={stats.expired}   icon={AlertTriangle} tone="danger" />
            <Stat label="Suspended" value={stats.suspended} icon={PauseCircle} tone="warning" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by product, key or client…"
                className="rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring w-72" />
            </div>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as any)}
              className="rounded-lg bg-surface border border-border px-2 py-2 text-xs">
              <option value="all">All states</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
              <FileBadge className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-3 text-sm font-semibold">No licenses yet</div>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Generate your first license — assign it to a client, set expiry and seats. You can renew, upgrade, transfer, suspend or expire it later.
              </p>
              <button onClick={() => setGenerating(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
                <KeyRound className="h-3.5 w-3.5" /> Generate License
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-card">
              <table className="w-full text-xs">
                <thead className="bg-surface text-muted-foreground">
                  <tr>
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">License key</th>
                    <th className="text-left p-2">Client</th>
                    <th className="text-left p-2">State</th>
                    <th className="text-left p-2">Seats</th>
                    <th className="text-left p-2">Expires</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const state = String(r.extra.state ?? "active") as LicState;
                    return (
                      <tr key={r.id} className="border-t border-border/60 hover:bg-surface/60">
                        <td className="p-2 font-medium cursor-pointer" onClick={() => setActiveId(r.id)}>{r.name}</td>
                        <td className="p-2 font-mono text-[10px]">{String(r.extra.key ?? "—")}</td>
                        <td className="p-2">{String(r.extra.clientName ?? "—")}</td>
                        <td className="p-2"><StatePill s={state} /></td>
                        <td className="p-2">{String(r.extra.seats ?? 1)}</td>
                        <td className="p-2 text-muted-foreground">{String(r.extra.expiry ?? "—")}</td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <RowBtn icon={Activity}      title="Activate" onClick={() => changeState(r.id, "active", "activated")} />
                            <RowBtn icon={RotateCcw}     title="Renew"    onClick={() => renewLicense(r, licenses.update)} />
                            <RowBtn icon={ArrowUp}       title="Upgrade"  onClick={() => upgradeLicense(r, licenses.update)} />
                            <RowBtn icon={ArrowLeftRight} title="Transfer" onClick={() => transferLicense(r, clients.records, licenses.update)} />
                            <RowBtn icon={PauseCircle}   title="Suspend"  onClick={() => changeState(r.id, "suspended", "suspended")} />
                            <RowBtn icon={XCircle}       title="Expire"   onClick={() => changeState(r.id, "expired", "expired")} />
                            <RowBtn icon={Trash2}        title="Delete"   danger onClick={() => deleteLicense(r.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {active && (
        <LicenseDetail
          rec={active}
          onPatch={(p) => licenses.update(active.id, p)}
          changeState={(s, a) => changeState(active.id, s, a)}
        />
      )}

      {generating && (
        <GenerateDialog
          clients={clients.records}
          onClose={() => setGenerating(false)}
          onCreate={(v) => {
            const rec = licenses.create({
              name: v.product,
              status: "active",
              extra: {
                key: v.key, clientId: v.clientId, clientName: v.clientName,
                state: "active", seats: v.seats, expiry: v.expiry,
                devices: [] as any, history: [{ id: rid(), action: "generated", date: new Date().toISOString() }] as any,
              },
            });
            toast.success("License generated");
            setGenerating(false);
            setActiveId(rec.id);
          }}
        />
      )}
    </div>
  );
}

function LicenseDetail({
  rec, onPatch, changeState,
}: {
  rec: CrudRecord;
  onPatch: (p: Partial<CrudRecord>) => void;
  changeState: (state: LicState, action: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const state = String(rec.extra.state ?? "active") as LicState;
  const devices: { id: string; name: string; platform: string; lastSeen: string }[] = Array.isArray((rec.extra as any).devices) ? (rec.extra as any).devices : [];
  const history: { id: string; action: string; date: string }[] = Array.isArray((rec.extra as any).history) ? (rec.extra as any).history : [];

  function copyKey() {
    navigator.clipboard?.writeText(String(rec.extra.key ?? ""));
    toast.success("License key copied");
  }
  function addDevice() {
    const name = prompt("Device name?")?.trim();
    if (!name) return;
    const platform = prompt("Platform (Web / iOS / Android / Desktop)?")?.trim() || "Web";
    const next = [{ id: rid(), name, platform, lastSeen: new Date().toISOString() }, ...devices];
    onPatch({ extra: { ...rec.extra, devices: next as any } });
    toast.success("Device added");
  }
  function revoke(id: string) {
    const next = devices.filter((d) => d.id !== id);
    onPatch({ extra: { ...rec.extra, devices: next as any } });
    toast.success("Device revoked");
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <div className="p-5 border-b border-border flex flex-wrap items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]"><FileBadge className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate">{rec.name}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono text-[10px] bg-surface border border-border rounded px-1.5 py-0.5">{String(rec.extra.key ?? "—")}</span>
            <button onClick={copyKey} title="Copy key" className="grid h-6 w-6 place-items-center rounded bg-surface hover:bg-surface-2 border border-border"><Copy className="h-3 w-3" /></button>
            <StatePill s={state} />
            <span>Client: <span className="text-foreground">{String(rec.extra.clientName ?? "—")}</span></span>
            <span>Seats: <span className="text-foreground">{String(rec.extra.seats ?? 1)}</span></span>
            <span>Expires: <span className="text-foreground">{String(rec.extra.expiry ?? "—")}</span></span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-surface/40">
        <ActionBtn icon={Activity}       label="Activate"  onClick={() => changeState("active", "activated")} />
        <ActionBtn icon={RotateCcw}      label="Renew"     onClick={() => { const e = prompt("New expiry (YYYY-MM-DD)?", String(rec.extra.expiry ?? "")); if (e) { onPatch({ extra: { ...rec.extra, expiry: e, state: "active", history: [{ id: rid(), action: `renewed → ${e}`, date: new Date().toISOString() }, ...history] as any } }); toast.success("License renewed"); } }} />
        <ActionBtn icon={ArrowUp}        label="Upgrade"   onClick={() => { const plan = prompt("Upgrade to plan?"); if (plan) { onPatch({ name: plan, extra: { ...rec.extra, history: [{ id: rid(), action: `upgraded → ${plan}`, date: new Date().toISOString() }, ...history] as any } }); toast.success("License upgraded"); } }} />
        <ActionBtn icon={ArrowLeftRight} label="Transfer"  onClick={() => { const c = prompt("Transfer to client (name)?"); if (c) { onPatch({ extra: { ...rec.extra, clientName: c, history: [{ id: rid(), action: `transferred → ${c}`, date: new Date().toISOString() }, ...history] as any } }); toast.success("License transferred"); } }} />
        <ActionBtn icon={PauseCircle}    label="Suspend"   onClick={() => changeState("suspended", "suspended")} />
        <ActionBtn icon={XCircle}        label="Expire"    danger onClick={() => changeState("expired", "expired")} />
      </div>

      <div className="flex items-center gap-1 px-3 pt-3 border-b border-border">
        {(["overview", "devices", "history"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-t-lg px-3 py-2 text-xs font-medium capitalize transition ${tab === t ? "bg-surface text-foreground border border-border border-b-transparent" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <Info label="Product" value={rec.name} />
            <Info label="License key" mono value={String(rec.extra.key ?? "—")} />
            <Info label="State" value={state} />
            <Info label="Client" value={String(rec.extra.clientName ?? "—")} />
            <Info label="Seats" value={String(rec.extra.seats ?? 1)} />
            <Info label="Expires" value={String(rec.extra.expiry ?? "—")} />
            <Info label="Created" value={new Date(rec.date).toLocaleString()} />
          </div>
        )}
        {tab === "devices" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{devices.length} active device{devices.length === 1 ? "" : "s"}</div>
              <button onClick={addDevice} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2">
                <Plus className="h-3.5 w-3.5" /> Add device
              </button>
            </div>
            {devices.length === 0 ? (
              <Empty icon={MonitorSmartphone} text="No devices registered for this license yet." />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium flex-1 truncate">{d.name}</span>
                    <span className="text-muted-foreground">{d.platform}</span>
                    <span className="text-muted-foreground">{new Date(d.lastSeen).toLocaleDateString()}</span>
                    <button onClick={() => revoke(d.id)} className="rounded-md bg-surface hover:bg-danger/15 hover:text-danger border border-border px-2 py-1 text-[10px]">Revoke</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "history" && (
          history.length === 0 ? <Empty icon={History} text="No license history yet." /> : (
            <ol className="relative border-l border-border ml-3 space-y-3">
              {history.map((h) => (
                <li key={h.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background bg-brand" />
                  <div className="text-xs capitalize font-semibold">{h.action}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(h.date).toLocaleString()}</div>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </div>
  );
}

/* ---------------- Generate dialog ---------------- */

function GenerateDialog({
  clients, onClose, onCreate,
}: {
  clients: CrudRecord[];
  onClose: () => void;
  onCreate: (v: { product: string; key: string; clientId: string; clientName: string; seats: number; expiry: string }) => void;
}) {
  const [v, setV] = useState({
    product: "", key: genKey(), clientId: clients[0]?.id ?? "", seats: 1,
    expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });
  const clientName = clients.find((c) => c.id === v.clientId)?.name ?? "";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand" />
          <div className="text-sm font-semibold">Generate License</div>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Product / plan *" value={v.product} onChange={(x) => setV({ ...v, product: x })} placeholder="e.g. SalesIQ Pro Annual" />
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Field label="License key" value={v.key} onChange={(x) => setV({ ...v, key: x })} mono />
            <button onClick={() => setV({ ...v, key: genKey() })} className="rounded-lg bg-surface border border-border px-3 py-2 text-xs hover:bg-surface-2">Regenerate</button>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Client</label>
            <select value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })}
              className="mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs">
              {clients.length === 0 && <option value="">— Create a client first —</option>}
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Field label="Seats"  value={String(v.seats)}  onChange={(x) => setV({ ...v, seats: Math.max(1, Number(x) || 1) })} type="number" />
            <Field label="Expiry" value={v.expiry} onChange={(x) => setV({ ...v, expiry: x })} type="date" />
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-surface/40">
          <button onClick={onClose} className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2">Cancel</button>
          <button
            disabled={!v.product.trim() || !v.clientId}
            onClick={() => onCreate({ ...v, clientName })}
            className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >Generate</button>
        </div>
      </div>
    </div>
  );
}

/* helpers */

function renewLicense(rec: CrudRecord, update: (id: string, p: Partial<CrudRecord>) => void) {
  const e = prompt("New expiry (YYYY-MM-DD)?", String(rec.extra.expiry ?? ""));
  if (!e) return;
  const history: any[] = Array.isArray((rec.extra as any).history) ? (rec.extra as any).history : [];
  update(rec.id, { extra: { ...rec.extra, expiry: e, state: "active", history: [{ id: rid(), action: `renewed → ${e}`, date: new Date().toISOString() }, ...history] as any } });
  toast.success("License renewed");
}
function upgradeLicense(rec: CrudRecord, update: (id: string, p: Partial<CrudRecord>) => void) {
  const plan = prompt("Upgrade to plan?");
  if (!plan) return;
  const history: any[] = Array.isArray((rec.extra as any).history) ? (rec.extra as any).history : [];
  update(rec.id, { name: plan, extra: { ...rec.extra, history: [{ id: rid(), action: `upgraded → ${plan}`, date: new Date().toISOString() }, ...history] as any } });
  toast.success("License upgraded");
}
function transferLicense(rec: CrudRecord, clients: CrudRecord[], update: (id: string, p: Partial<CrudRecord>) => void) {
  const name = prompt(`Transfer to client (name) — available: ${clients.map(c => c.name).join(", ") || "none"}`);
  if (!name) return;
  const c = clients.find((x) => x.name.toLowerCase() === name.toLowerCase());
  const history: any[] = Array.isArray((rec.extra as any).history) ? (rec.extra as any).history : [];
  update(rec.id, { extra: { ...rec.extra, clientId: c?.id ?? "", clientName: name, history: [{ id: rid(), action: `transferred → ${name}`, date: new Date().toISOString() }, ...history] as any } });
  toast.success("License transferred");
}
function genKey() {
  const blocks = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6).toUpperCase());
  return `SV-${blocks.join("-")}`;
}
function rid() { return Math.random().toString(36).slice(2, 9); }

function StatePill({ s }: { s: LicState }) {
  const map = {
    active:    "bg-success/15 text-success",
    trial:     "bg-[oklch(0.78_0.16_210)]/15 text-[oklch(0.78_0.16_210)]",
    expired:   "bg-danger/15 text-danger",
    suspended: "bg-warning/15 text-warning",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${map[s]}`}>{s}</span>;
}
function Stat({ label, value, icon: I, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: "brand" | "success" | "warning" | "danger" | "cyan" }) {
  const toneText = { brand: "text-brand", success: "text-success", warning: "text-warning", danger: "text-danger", cyan: "text-[oklch(0.78_0.16_210)]" }[tone];
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <I className={`h-3.5 w-3.5 ${toneText}`} />
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}
function RowBtn({ icon: I, title, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-md bg-surface border border-border transition ${danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface-2"}`}>
      <I className="h-3.5 w-3.5" />
    </button>
  );
}
function ActionBtn({ icon: I, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${danger ? "bg-danger/10 text-danger border-danger/30 hover:bg-danger/20" : "bg-surface border-border hover:bg-surface-2"}`}>
      <I className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
function Field({ label, value, onChange, type = "text", placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "font-mono text-xs" : "font-semibold"}`}>{value}</div>
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
void Inbox;
