/**
 * ManagerWall — the shared, config-driven data wall used by the Franchise,
 * Reseller and SEO manager modules. Feature parity with the upstream
 * Software Vala walls (search, filters, KPIs, sorting, selection, bulk
 * actions, row actions, create/edit drawer, delete) rendered entirely with
 * this project's own UI primitives and design tokens.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Card, PageHeader, PillButton, StatCard } from "@/components/marketplace-manager/ui";
import { createTable, uid } from "@/lib/marketplace-manager/store";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type WallRow = Record<string, any> & { id: string };

export type WallField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "email" | "select";
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
};

export type WallColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
  className?: string;
  render?: (row: any) => ReactNode;
};

export type WallFilterDef = { key: string; label: string; options: readonly string[] };

export type WallKpi = {
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  compute: (rows: any[]) => string | number;
};

export type WallBulkAction = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive";
  patch?: Record<string, any>;
  confirmTitle?: string;
  confirmDescription?: string;
};

export type WallRowAction = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  patch?: Record<string, any>;
  destructive?: boolean;
};

export type WallConfig = {
  scope: string;
  entity: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryLabel: string;
  route?: string;
  seed: any[];
  columns: WallColumn[];
  filters: WallFilterDef[];
  kpis: WallKpi[];
  bulkActions: WallBulkAction[];
  rowActions?: WallRowAction[];
  formFields: WallField[];
  searchFields: string[];
  primaryField: string;
  subField?: string;
  statusField?: string;
  statusColorMap?: Record<string, string>;
  sortOptions?: { key: string; label: string; compare: (a: any, b: any) => number }[];
  renderDetail?: (row: any) => ReactNode;
  panels?: { title: string; items: string[] }[];
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const TONES: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-accent/40 bg-accent/10 text-accent",
  premium: "border-premium/40 bg-premium/10 text-premium",
  muted: "border-border bg-white/[0.03] text-muted-foreground",
};

function toneFor(value: string) {
  const v = String(value ?? "").toLowerCase();
  if (/(active|approved|verified|paid|resolved|fulfilled|published|platinum|success|live)/.test(v)) return "success";
  if (/(pending|processing|submitted|review|draft|scheduled|warning|medium|gold)/.test(v)) return "warning";
  if (/(rejected|failed|expired|blocked|critical|suspended|cancelled|revoked|terminated|high)/.test(v)) return "danger";
  if (/(info|open|new|low|bronze)/.test(v)) return "info";
  if (/(enterprise|premium|diamond)/.test(v)) return "premium";
  return "muted";
}

export function StatusPill({ value, children }: { value?: string; children?: ReactNode }) {
  const label = children ?? cap(String(value ?? "—"));
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        TONES[toneFor(String(value ?? ""))]
      }`}
    >
      {label}
    </span>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: WallField;
  value: any;
  onChange: (v: any) => void;
}) {
  const base =
    "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] text-foreground outline-none transition focus:border-accent/50";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea rows={3} className={base} value={value ?? ""} placeholder={field.placeholder ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select className={base} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {cap(o)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          className={base}
          value={value ?? ""}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
        />
      )}
    </label>
  );
}

const PAGE_SIZE = 10;

export function ManagerWall({ config }: { config: WallConfig }) {
  const table = useMemo(() => createTable<WallRow>(`wall:${config.scope}`, config.seed as WallRow[]), [config]);

  const [rows, setRows] = useState<WallRow[]>(() => table.all());
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WallRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [detail, setDetail] = useState<WallRow | null>(null);

  useEffect(() => {
    setRows(table.all());
    setSearch("");
    setFilters({});
    setSelected(new Set());
    setPage(1);
  }, [table]);

  const commit = (next: WallRow[]) => {
    table.replace(next);
    setRows(next);
  };

  const filtered = useMemo(() => {
    let out = rows;
    for (const [k, v] of Object.entries(filters)) {
      if (v) out = out.filter((r) => String(r[k] ?? "") === v);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => config.searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)));
    }
    if (sortKey) {
      out = [...out].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const res = av > bv ? 1 : -1;
        return sortDir === "asc" ? res : -res;
      });
    }
    return out;
  }, [rows, filters, search, sortKey, sortDir, config.searchFields]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    const d: Record<string, any> = {};
    for (const f of config.formFields) if (f.defaultValue !== undefined) d[f.key] = f.defaultValue;
    setDraft(d);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: WallRow) => {
    setDraft({ ...row });
    setEditing(row);
    setCreating(true);
  };

  const save = () => {
    const missing = config.formFields.filter((f) => f.required && !draft[f.key]);
    if (missing.length) {
      toast.error(`Missing: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    if (editing) {
      commit(rows.map((r) => (r.id === editing.id ? ({ ...r, ...draft } as WallRow) : r)));
      toast.success(`${cap(config.entity)} updated`);
    } else {
      const row = {
        ...draft,
        id: uid(),
        created_at: draft["created_at"] ?? new Date().toISOString().slice(0, 10),
      } as WallRow;
      commit([row, ...rows]);
      toast.success(`${cap(config.entity)} created`);
    }
    setCreating(false);
    setEditing(null);
  };

  const applyPatch = (ids: string[], patch?: Record<string, any>, remove?: boolean) => {
    if (remove) {
      commit(rows.filter((r) => !ids.includes(r.id)));
      toast.success(`${ids.length} ${config.entity}(s) deleted`);
    } else {
      commit(rows.map((r) => (ids.includes(r.id) ? ({ ...r, ...patch } as WallRow) : r)));
      toast.success(`${ids.length} ${config.entity}(s) updated`);
    }
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const Icon = config.icon;

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.subtitle}
        actions={
          <>
            <PillButton onClick={() => toast.success("Export queued")}>Export</PillButton>
            <PillButton variant="primary" onClick={openCreate}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> {config.primaryLabel}
              </span>
            </PillButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {config.kpis.map((k, i) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={String(k.compute(filtered))}
            {...(k.hint ? { delta: k.hint } : {})}
            tone={i === 1 ? "success" : i === 2 ? "warning" : i === 3 ? "premium" : "default"}
            icon={<k.icon className="h-3.5 w-3.5" />}
          />
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${config.entity}s…`}
              className="w-full rounded-lg border border-border bg-background/60 py-2 pl-9 pr-3 text-[12px] outline-none transition focus:border-accent/50"
            />
          </div>
          {config.filters.map((f) => (
            <select
              key={f.key}
              value={filters[f.key] ?? ""}
              onChange={(e) => {
                setFilters((s) => ({ ...s, [f.key]: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-background/60 px-3 py-2 text-[12px] outline-none focus:border-accent/50"
            >
              <option value="">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {cap(o)}
                </option>
              ))}
            </select>
          ))}
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-muted-foreground transition hover:text-accent"
          >
            <ArrowDownUp className="h-3.5 w-3.5" /> {sortDir === "asc" ? "Asc" : "Desc"}
          </button>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">{selected.size} selected</span>
            {config.bulkActions.map((b) => (
              <button
                key={b.key}
                onClick={() => applyPatch([...selected], b.patch, b.key === "delete")}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  b.variant === "destructive"
                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                    : "border-border text-foreground hover:border-accent/40 hover:text-accent"
                }`}
              >
                <b.icon className="h-3.5 w-3.5" /> {b.label}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                    onChange={() =>
                      setSelected((s) =>
                        paged.every((r) => s.has(r.id)) ? new Set() : new Set(paged.map((r) => r.id)),
                      )
                    }
                  />
                </th>
                {config.columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => setSortKey(c.key)}
                    className={`cursor-pointer px-4 py-3 font-bold transition hover:text-accent ${
                      c.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + 2} className="px-4 py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background/60 text-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-sm font-bold">No {config.entity}s match this view</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Adjust filters or create a new {config.entity} to get started.
                    </div>
                  </td>
                </tr>
              )}
              {paged.map((r) => (
                <tr key={r.id} className="border-b border-border/60 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  {config.columns.map((c) => (
                    <td
                      key={c.key}
                      onClick={() => setDetail(r)}
                      className={`cursor-pointer px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}
                    >
                      {c.render ? c.render(r) : (r[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      {(config.rowActions ?? []).map((a) => (
                        <button
                          key={a.key}
                          onClick={() => applyPatch([r.id], a.patch)}
                          title={a.label}
                          className={`rounded-md border border-border p-1.5 transition hover:border-accent/40 ${
                            a.destructive ? "text-destructive" : "text-muted-foreground hover:text-accent"
                          }`}
                        >
                          {a.icon ? <a.icon className="h-3.5 w-3.5" /> : a.label}
                        </button>
                      ))}
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition hover:border-accent/40 hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => applyPatch([r.id], undefined, true)}
                        title="Delete"
                        className="rounded-md border border-border p-1.5 text-destructive transition hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <span>
            {filtered.length} {config.entity}
            {filtered.length === 1 ? "" : "s"} · page {page} / {pages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {config.panels && config.panels.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {config.panels.map((p) => (
            <Card key={p.title}>
              <div className="text-sm font-bold">{p.title}</div>
              <ul className="mt-3 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{it}</span>
                    <span className="font-mono text-foreground">—</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {/* create / edit drawer */}
      {creating && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{config.eyebrow}</div>
                <h2 className="mt-1 text-lg font-bold">
                  {editing ? `Edit ${config.entity}` : config.primaryLabel}
                </h2>
              </div>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              {config.formFields.map((f) => (
                <Field key={f.key} field={f} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <PillButton onClick={() => setCreating(false)}>Cancel</PillButton>
              <PillButton variant="primary" onClick={save}>
                {editing ? "Save changes" : "Create"}
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{config.entity}</div>
                <h2 className="mt-1 text-lg font-bold">{String(detail[config.primaryField] ?? detail.id)}</h2>
                {config.subField && (
                  <div className="text-[11px] text-muted-foreground">{String(detail[config.subField] ?? "")}</div>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {config.renderDetail ? (
              config.renderDetail(detail)
            ) : (
              <div className="space-y-2">
                {Object.entries(detail)
                  .filter(([k]) => k !== "id")
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-[11px]">
                      <span className="uppercase tracking-wider text-muted-foreground">{k.replace(/_/g, " ")}</span>
                      <span className="font-mono text-foreground">{String(v)}</span>
                    </div>
                  ))}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <PillButton onClick={() => setDetail(null)}>Close</PillButton>
              <PillButton
                variant="primary"
                onClick={() => {
                  openEdit(detail);
                  setDetail(null);
                }}
              >
                Edit
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}