// Marketplace Manager — Demo URL Center.
// Full CRUD + live health-check backed by product_demo_urls.
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/marketplace-manager/localFn";
import { toast } from "sonner";
import {
  Plus, Save, Trash2, X, Loader2, Edit3, Copy, Play, ExternalLink,
  Power, PowerOff, ShieldCheck, ShieldAlert, Activity, Wifi, WifiOff, Gauge, History,
} from "lucide-react";
import {
  listDemoUrls, upsertDemoUrl, deleteDemoUrl, duplicateDemoUrl,
  toggleDemoUrl, testDemoUrl, testAllDemoUrls, listDemoAuditLog,
  type DemoUrl, type DemoAuditEntry,
} from "@/lib/marketplace-manager/demo";
import { listProductsAdmin } from "@/lib/marketplace-manager/catalog";

import { Card, PageHeader, PillButton } from "../ui";

const EMPTY: Partial<DemoUrl> = {
  demo_name: "", role_name: "User", url: "", username: "", password: "",
  description: "", environment: "production", status: "active", sort_order: 0,
  product_id: null,
};

const ROLE_PRESETS = [
  "User","Admin","Super Admin","Teacher","Student","Parent","Vendor","Author",
  "Reseller","Franchise","Accountant","Manager","Employee","Support","Guest",
];

export function DemoUrlManagerSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDemoUrls);
  const upsertFn = useServerFn(upsertDemoUrl);
  const deleteFn = useServerFn(deleteDemoUrl);
  const duplicateFn = useServerFn(duplicateDemoUrl);
  const toggleFn = useServerFn(toggleDemoUrl);
  const testFn = useServerFn(testDemoUrl);
  const testAllFn = useServerFn(testAllDemoUrls);
  const productsFn = useServerFn(listProductsAdmin);
  const auditFn = useServerFn(listDemoAuditLog);


  const { data: rows = [], isLoading } = useQuery<DemoUrl[]>({
    queryKey: ["demo_urls"],
    queryFn: async () => (await listFn()) as unknown as DemoUrl[],
  });
  const { data: products = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["mp_products_admin_slim"],
    queryFn: async () => (await productsFn()) as unknown as { id: string; name: string }[],
  });
  const { data: audit = [], isLoading: auditLoading } = useQuery<DemoAuditEntry[]>({
    queryKey: ["demo_audit_log"],
    queryFn: async () => (await auditFn({ data: { limit: 100 } })) as unknown as DemoAuditEntry[],
  });



  const [editing, setEditing] = useState<Partial<DemoUrl> | null>(null);
  const [filter, setFilter] = useState<"all" | "working" | "slow" | "offline" | "inactive">("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["demo_urls"] });
    qc.invalidateQueries({ queryKey: ["demo_audit_log"] });
  };


  const upsertMut = useMutation({
    mutationFn: (v: Partial<DemoUrl>) => upsertFn({ data: v as any }),
    onSuccess: () => { invalidate(); toast.success("Demo saved"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => duplicateFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Duplicated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "inactive" }) => toggleFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const testMut = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Checked"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const testAllMut = useMutation({
    mutationFn: async () => testAllFn(),
    onSuccess: (r: any) => { invalidate(); toast.success(`Checked ${Array.isArray(r) ? r.length : 0} demos`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const t = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const working = rows.filter((r) => r.last_result === "working").length;
    const slow = rows.filter((r) => r.last_result === "slow").length;
    const offline = rows.filter((r) => r.last_result === "offline").length;
    const ssl = rows.filter((r) => r.ssl_valid === true).length;
    const lastChecked = rows
      .map((r) => (r.last_checked_at ? new Date(r.last_checked_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    return { t, active, working, slow, offline, ssl, lastChecked };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "inactive") return rows.filter((r) => r.status === "inactive");
    return rows.filter((r) => r.last_result === filter);
  }, [rows, filter]);

  const productName = (id: string | null) =>
    id ? products.find((p) => p.id === id)?.name ?? "—" : "—";

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Product Demos · Live Health"
        title="Demo URL Manager"
        description="Manage unlimited role-based demo environments per product. Test URLs live, track uptime, response time and SSL status."
        actions={
          <div className="flex gap-2">
            <PillButton variant="ghost" onClick={() => testAllMut.mutate()}>
              <span className="inline-flex items-center gap-1.5">
                {testAllMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Activity className="h-3.5 w-3.5"/>}
                Test All
              </span>
            </PillButton>
            <PillButton variant="primary" onClick={() => setEditing({ ...EMPTY })}>
              <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New Demo URL</span>
            </PillButton>
          </div>
        }
      />

      {/* Dashboard */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total" value={stats.t} />
        <Stat label="Active" value={stats.active} tone="accent" />
        <Stat label="Working" value={stats.working} tone="success" icon={<Wifi className="h-3.5 w-3.5"/>} />
        <Stat label="Slow" value={stats.slow} tone="warning" icon={<Gauge className="h-3.5 w-3.5"/>} />
        <Stat label="Offline" value={stats.offline} tone="danger" icon={<WifiOff className="h-3.5 w-3.5"/>} />
        <Stat label="SSL Valid" value={stats.ssl} tone="success" icon={<ShieldCheck className="h-3.5 w-3.5"/>} />
        <Stat label="Last Check" value={stats.lastChecked ? new Date(stats.lastChecked).toLocaleTimeString() : "—"} />
      </div>

      {/* Filter */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all","working","slow","offline","inactive"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              filter === k ? "bg-accent text-accent-foreground" : "bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><div className="text-sm text-muted-foreground">No demo URLs. Add your first demo — supports unlimited role-based credentials per product.</div></Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Demo</Th><Th>Role</Th><Th>Product</Th><Th>Env</Th><Th>URL</Th>
                <Th>Creds</Th><Th>Health</Th><Th>Last Check</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-middle">
                  <Td className="font-medium">{r.demo_name}</Td>
                  <Td>{r.role_name}</Td>
                  <Td className="text-muted-foreground">{productName(r.product_id)}</Td>
                  <Td><EnvChip env={r.environment} /></Td>
                  <Td>
                    <div className="flex max-w-[280px] items-center gap-1">
                      <span className="truncate text-muted-foreground">{r.url}</span>
                      <IconBtn label="Copy URL" onClick={() => copy(r.url, "URL copied")}><Copy className="h-3 w-3"/></IconBtn>
                      <IconBtn label="Open" onClick={() => window.open(r.url, "_blank", "noopener,noreferrer")}><ExternalLink className="h-3 w-3"/></IconBtn>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[140px]">{r.username || "—"}</span>
                        {r.username && <IconBtn label="Copy user" onClick={() => copy(r.username!, "Username copied")}><Copy className="h-3 w-3"/></IconBtn>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[140px]">{r.password ? "••••••••" : "—"}</span>
                        {r.password && <IconBtn label="Copy pass" onClick={() => copy(r.password!, "Password copied")}><Copy className="h-3 w-3"/></IconBtn>}
                      </div>
                    </div>
                  </Td>
                  <Td><HealthChip r={r} /></Td>
                  <Td className="text-[11px] text-muted-foreground">
                    {r.last_checked_at ? new Date(r.last_checked_at).toLocaleString() : "—"}
                    {r.last_response_ms != null && <div>{r.last_response_ms} ms · HTTP {r.last_http_status ?? "—"}</div>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <IconBtn label="Test" onClick={() => testMut.mutate(r.id)}>
                        {testMut.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Play className="h-3 w-3"/>}
                      </IconBtn>
                      <IconBtn label="Toggle" onClick={() => toggleMut.mutate({ id: r.id, status: r.status === "active" ? "inactive" : "active" })}>
                        {r.status === "active" ? <Power className="h-3 w-3 text-emerald-400"/> : <PowerOff className="h-3 w-3 text-muted-foreground"/>}
                      </IconBtn>
                      <IconBtn label="Edit" onClick={() => setEditing(r)}><Edit3 className="h-3 w-3"/></IconBtn>
                      <IconBtn label="Duplicate" onClick={() => dupMut.mutate(r.id)}><Copy className="h-3 w-3"/></IconBtn>
                      <IconBtn label="Delete" onClick={() => { if (confirm(`Delete "${r.demo_name}"?`)) delMut.mutate(r.id); }}>
                        <Trash2 className="h-3 w-3"/>
                      </IconBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> Audit Log
              <span className="text-[11px] font-normal text-muted-foreground">
                (last {audit.length})
              </span>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["demo_audit_log"] })}
              className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>
          {auditLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
          ) : audit.length === 0 ? (
            <div className="text-sm text-muted-foreground">No audit entries yet. Actions on demo URLs will appear here.</div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white/[0.04] text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Demo</Th><Th>Details</Th></tr>
                </thead>
                <tbody>
                  {audit.map((a) => {
                    const demoName = a.demo_url_id
                      ? rows.find((r) => r.id === a.demo_url_id)?.demo_name ?? a.demo_url_id.slice(0, 8)
                      : "—";
                    const meta = a.metadata && typeof a.metadata === "object" ? a.metadata : {};
                    return (
                      <tr key={a.id} className="border-t border-border/60 align-top">
                        <Td className="whitespace-nowrap text-muted-foreground">{new Date(a.created_at).toLocaleString()}</Td>
                        <Td className="text-muted-foreground">{a.actor_email ?? a.actor_id?.slice(0, 8) ?? "system"}</Td>
                        <Td><span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{a.action.replace("demo_url.", "")}</span></Td>
                        <Td className="font-medium">{demoName}</Td>
                        <Td className="max-w-[380px] truncate text-muted-foreground">
                          <span title={JSON.stringify(meta)}>
                            {Object.entries(meta as Record<string, unknown>)
                              .filter(([k]) => k !== "actor" && k !== "ts")
                              .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                              .join(" · ") || "—"}
                          </span>
                        </Td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {editing && (

        <DemoEditor
          value={editing}
          products={products}
          onCancel={() => setEditing(null)}
          onSave={(v) => upsertMut.mutate(v)}
          saving={upsertMut.isPending}
        />
      )}
    </div>
  );
}

function DemoEditor({
  value, products, onCancel, onSave, saving,
}: {
  value: Partial<DemoUrl>;
  products: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (v: Partial<DemoUrl>) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<Partial<DemoUrl>>(value);
  const set = <K extends keyof DemoUrl>(k: K, val: DemoUrl[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-[color:var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{v.id ? "Edit Demo URL" : "New Demo URL"}</h3>
          <button onClick={onCancel}><X className="h-4 w-4"/></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Demo name"><input className={inp} value={v.demo_name ?? ""} onChange={(e) => set("demo_name", e.target.value)} placeholder="Admin Demo"/></Field>
          <Field label="Role name">
            <input list="role-presets" className={inp} value={v.role_name ?? ""} onChange={(e) => set("role_name", e.target.value)} placeholder="Admin / Teacher / Vendor…"/>
            <datalist id="role-presets">
              {ROLE_PRESETS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </Field>
          <Field label="Product">
            <select className={inp} value={v.product_id ?? ""} onChange={(e) => set("product_id", (e.target.value || null) as any)}>
              <option value="">— Unassigned —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Environment">
            <select className={inp} value={v.environment ?? "production"} onChange={(e) => set("environment", e.target.value as any)}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="testing">Testing</option>
            </select>
          </Field>
          <Field label="URL" full><input className={inp} value={v.url ?? ""} onChange={(e) => set("url", e.target.value)} placeholder="https://demo.example.com"/></Field>
          <Field label="Username / Email"><input className={inp} value={v.username ?? ""} onChange={(e) => set("username", e.target.value)} /></Field>
          <Field label="Password"><input className={inp} value={v.password ?? ""} onChange={(e) => set("password", e.target.value)} /></Field>
          <Field label="Description" full><textarea rows={2} className={inp} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Status">
            <select className={inp} value={v.status ?? "active"} onChange={(e) => set("status", e.target.value as any)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Sort order"><input type="number" className={inp} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <PillButton variant="ghost" onClick={onCancel}>Cancel</PillButton>
          <PillButton variant="primary" onClick={() => onSave(v)}>
            <span className="inline-flex items-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} Save
            </span>
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/* ---------- bits ---------- */
const inp = "w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="rounded border border-border p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
      {children}
    </button>
  );
}
function Stat({ label, value, tone, icon }: { label: string; value: number | string; tone?: "success"|"warning"|"danger"|"accent"; icon?: ReactNode }) {
  const color =
    tone === "success" ? "text-emerald-300" :
    tone === "warning" ? "text-amber-300" :
    tone === "danger"  ? "text-rose-300" :
    tone === "accent"  ? "text-accent" : "text-foreground";
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
function EnvChip({ env }: { env: DemoUrl["environment"] }) {
  const map = {
    production: "bg-emerald-500/15 text-emerald-300",
    staging: "bg-amber-500/15 text-amber-300",
    testing: "bg-sky-500/15 text-sky-300",
  } as const;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${map[env]}`}>{env}</span>;
}
function HealthChip({ r }: { r: DemoUrl }) {
  if (r.status === "inactive") return <Badge tone="muted">Disabled</Badge>;
  if (r.last_result === "working") return <Badge tone="success">✅ Working</Badge>;
  if (r.last_result === "slow") return <Badge tone="warning">⚠ Slow</Badge>;
  if (r.last_result === "offline") return <Badge tone="danger">❌ Offline</Badge>;
  return <Badge tone="muted">Untested</Badge>;
}
function Badge({ tone, children }: { tone: "success"|"warning"|"danger"|"muted"; children: ReactNode }) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-300",
    danger:  "bg-rose-500/15 text-rose-300",
    muted:   "bg-muted/40 text-muted-foreground",
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${map[tone]}`}>{children}</span>;
}
async function copy(text: string, msg: string) {
  try { await navigator.clipboard.writeText(text); toast.success(msg); }
  catch { toast.error("Copy failed"); }
}
// re-export used icons so tree-shaker keeps them
void ShieldAlert;
