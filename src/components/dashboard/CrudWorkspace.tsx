import { useCallback, useMemo, useState, useEffect, useRef, createContext, useContext } from "react";
import {
  ArrowLeft, Plus, Search, Download, Upload, Archive, Check, X, Eye, MoreHorizontal, LayoutGrid, List as ListIcon, Table as TableIcon, ChevronLeft, ChevronRight, CheckCheck, RotateCcw, FileJson, FileText, Printer, Share2, Paperclip, MessageSquare, History, ShieldCheck, Inbox, AlertTriangle, Tag, Calendar, DollarSign, User, FolderOpen, Clock, ListChecks,
} from "lucide-react";
import { can, type Capability } from "@/lib/permissions";
import { toast } from "sonner";
import type { RoleConfig } from "@/lib/roles";
import { useNavigate } from "@tanstack/react-router";
import { exportJson, downloadFile, type CrudRecord, type RecordStatus } from "@/lib/crud-store";
import { sourceFor, type AmountKind } from "@/lib/dashboard-records/sources";
import { useDashboardRecords } from "@/lib/dashboard-records/use-dashboard-records";

type View = "table" | "grid" | "list";
type Mode = { kind: "list" } | { kind: "detail"; id: string };

const STATUS_OPTIONS: RecordStatus[] = ["active", "pending", "approved", "rejected", "draft", "archived"];

const statusTone: Record<RecordStatus, string> = {
  active:   "bg-success/15 text-success",
  pending:  "bg-warning/15 text-warning",
  approved: "bg-brand/15 text-brand",
  rejected: "bg-danger/15 text-danger",
  draft:    "bg-surface-2 text-muted-foreground",
  archived: "bg-surface-2 text-muted-foreground/70 line-through",
};

function StatusPill({ s }: { s: RecordStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone[s]}`}>{s}</span>;
}

/**
 * A record's amount, as its module measures it. Every amount used to be shown
 * as US dollars, whatever it was - a follower count, a rating, a price in
 * rupees. Money is shown in the record's own currency, and without a symbol
 * when the record does not say which currency it is.
 */
function fmtAmount(r: Pick<CrudRecord, "amount" | "extra">, kind: AmountKind) {
  const n = r.amount;
  if (kind === "none") return "—";
  if (kind === "count") return n.toLocaleString();
  if (kind === "percent") return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  const currency = typeof r.extra?.currency === "string" ? r.extra.currency : null;
  if (!currency) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  try {
    return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  }
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

const CapContext = createContext<(cap: Capability) => boolean>(() => true);
const useCap = () => useContext(CapContext);

/** How this module's amounts read. */
const AmountContext = createContext<{ kind: AmountKind; label: string }>({ kind: "money", label: "Amount" });
const useAmount = () => useContext(AmountContext);

/**
 * What changes a record. A module read from the platform shows the platform's
 * records as they are: an order, a commission or a click is not something to
 * edit, duplicate or delete from here, so none of these are offered on it.
 */
const WRITE_CAPS = new Set<Capability>(["create", "update", "delete", "approve", "import", "reset_data"]);

type CrudProps = { role: RoleConfig; moduleKey: string; onBack: () => void };

export function CrudWorkspace(props: CrudProps) {
  const source = sourceFor(props.role.key, props.moduleKey);
  // Records read from the platform are shown as they are; see WRITE_CAPS.
  const cap = useCallback(
    (c: Capability) => !WRITE_CAPS.has(c) && can(props.role.key, c),
    [props.role.key],
  );
  if (source.kind === "route") return <OpenElsewhere {...props} to={source.to} label={source.label} />;
  if (source.kind !== "records") {
    return (
      <NotConnected
        {...props}
        reason={source.kind === "none" ? source.reason : `This is done in ${source.label}.`}
      />
    );
  }
  return (
    <CapContext.Provider value={cap}>
      <AmountContext.Provider value={{ kind: source.amountKind, label: source.amountLabel || "Amount" }}>
        <CrudWorkspaceInner {...props} />
      </AmountContext.Provider>
    </CapContext.Provider>
  );
}

function ModuleHeading({ role, moduleKey, onBack }: CrudProps) {
  const mod = role.modules.find((m) => m.key === moduleKey) ?? { key: moduleKey, label: moduleKey, icon: Inbox };
  const Icon = mod.icon;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]">
          <Icon className="h-4 w-4" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{mod.label}</h1>
      </div>
    </div>
  );
}

/** A module the platform already has a full screen for: it opens that screen. */
function OpenElsewhere(props: CrudProps & { to: string; label: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: props.to });
  }, [navigate, props.to]);
  return (
    <div className="space-y-5">
      <ModuleHeading {...props} />
      <EmptyState
        icon={FolderOpen}
        title={`Opening ${props.label}…`}
        sub={`This is managed in ${props.label}, which has the full records and every action.`}
        primary={{ label: `Open ${props.label}`, onClick: () => void navigate({ to: props.to }) }}
      />
    </div>
  );
}

/** A module with no record behind it on the platform. It says so instead of pretending. */
function NotConnected(props: CrudProps & { reason: string }) {
  return (
    <div className="space-y-5">
      <ModuleHeading {...props} />
      <EmptyState
        icon={Inbox}
        title="Not connected yet"
        sub={props.reason}
        secondary={{ label: "Back to Dashboard", onClick: props.onBack }}
      />
    </div>
  );
}

function CrudWorkspaceInner({ role, moduleKey, onBack }: CrudProps) {
  const allow = useCap();
  const mod = role.modules.find((m) => m.key === moduleKey) ?? { key: moduleKey, label: moduleKey, icon: Inbox };
  const Icon = mod.icon;
  const singular = mod.label.replace(/s$/, "") || mod.label;

  const crud = useDashboardRecords(role.key, moduleKey, true);
  const amount = useAmount();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc" | "amount_desc">("date_desc");
  const [view, setView] = useState<View>("table");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importRef = useRef<HTMLInputElement>(null);

  // Reset selection / page when module changes
  useEffect(() => { setSelected(new Set()); setMode({ kind: "list" }); setPage(1); setQuery(""); setStatusFilter("all"); }, [moduleKey, role.key]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = crud.records.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "date_asc":   return a.date.localeCompare(b.date);
        case "name_asc":   return a.name.localeCompare(b.name);
        case "amount_desc":return b.amount - a.amount;
        default:           return b.date.localeCompare(a.date);
      }
    });
    return list;
  }, [crud.records, query, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: crud.records.length, active: 0, pending: 0, archived: 0 };
    for (const r of crud.records) if (c[r.status] !== undefined) c[r.status]++;
    return c;
  }, [crud.records]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (paged.every((r) => selected.has(r.id))) {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((r) => n.delete(r.id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); paged.forEach((r) => n.add(r.id)); return n; });
    }
  }

  function handleExport(records: CrudRecord[]) {
    downloadFile(`${role.key}-${moduleKey}-${Date.now()}.json`, exportJson(records));
    toast.success(`Exported ${records.length} record${records.length === 1 ? "" : "s"}`);
  }

  function handleImportClick() { importRef.current?.click(); }
  // Records read from the platform are never imported into from a file.
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    e.target.value = "";
  }

  // ============ HEADER (always visible) ============
  const Header = (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={mode.kind === "list" ? onBack : () => setMode({ kind: "list" })}
        className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
        <ArrowLeft className="h-3.5 w-3.5" />
        {mode.kind === "list" ? "Back to Dashboard" : "Back to list"}
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-[oklch(0.72_0.2_265)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <nav className="text-[11px] text-muted-foreground flex items-center gap-1">
            <button onClick={onBack} className="hover:text-foreground">{role.title}</button>
            <span>/</span>
            <button onClick={() => setMode({ kind: "list" })} className="hover:text-foreground">{mod.label}</button>
            {mode.kind === "detail" && <><span>/</span><span className="text-foreground">Details</span></>}
          </nav>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{mod.label}</h1>
        </div>
      </div>
    </div>
  );


  if (mode.kind === "detail") {
    const rec = crud.records.find((r) => r.id === mode.id);
    if (!rec) {
      return (
        <div className="space-y-5">
          {Header}
          <EmptyState
            icon={AlertTriangle}
            title="Record not found"
            sub="It may have been deleted. Return to the list to continue."
            primary={{ label: "Back to list", onClick: () => setMode({ kind: "list" }) }}
          />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {Header}
        <DetailView
          rec={rec}
          singular={singular}
          onExport={() => handleExport([rec])}
        />
      </div>
    );
  }

  // LIST MODE
  return (
    <div className="space-y-5">
      {Header}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={`Search ${mod.label.toLowerCase()}…`}
            className="rounded-lg bg-surface border border-border pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring w-56"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as RecordStatus | "all"); setPage(1); }}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          aria-label="Sort records"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="amount_desc">Amount high→low</option>
        </select>

        <div className="flex items-center gap-0.5 rounded-lg bg-surface border border-border p-0.5">
          {([["table", TableIcon], ["grid", LayoutGrid], ["list", ListIcon]] as const).map(([v, I]) => (
            <button key={v} onClick={() => setView(v)} title={v}
              className={`grid place-items-center rounded-md h-7 w-7 transition ${view === v ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
          {allow("import") && <button onClick={handleImportClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            <Upload className="h-3.5 w-3.5" /> Import
          </button>}
          {allow("export") && <button onClick={() => handleExport(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            <Download className="h-3.5 w-3.5" /> Export
          </button>}
          <button onClick={crud.refresh}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            <RotateCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, icon: ListChecks },
          { label: "Active", value: counts.active, icon: Check },
          { label: "Pending", value: counts.pending, icon: Clock },
          { label: "Archived", value: counts.archived, icon: Archive },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border p-4 depth-3d sheen-3d">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {allow("export") && <BulkBtn icon={Download} label="Export" onClick={() => { handleExport(crud.records.filter(r => selected.has(r.id))); }} />}
            <BulkBtn icon={X} label="Clear" onClick={() => setSelected(new Set())} />
          </div>
        </div>
      )}

      {/* Body: views */}
      {crud.note && crud.records.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">{crud.note}</div>
      )}
      {crud.loading ? (
        <EmptyState icon={Clock} title={`Loading ${mod.label.toLowerCase()}…`} sub="Reading your records from the platform." />
      ) : crud.error ? (
        <EmptyState
          icon={AlertTriangle}
          title={`${mod.label} could not be read`}
          sub={crud.error}
          secondary={{ label: "Try again", onClick: crud.refresh }}
        />
      ) : crud.records.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`No ${mod.label.toLowerCase()} yet`}
          sub={crud.note ?? `Nothing has been recorded here yet. ${mod.label} appear here as they happen on the platform.`}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`No ${mod.label.toLowerCase()} match your filters`}
          sub="Try clearing the search or choosing another status."
          secondary={{ label: "Clear filters", onClick: () => { setQuery(""); setStatusFilter("all"); } }}
        />
      ) : view === "table" ? (
        <TableView
          rows={paged}
          selected={selected}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
          allChecked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
          onOpen={(id) => setMode({ kind: "detail", id })}
        />
      ) : view === "grid" ? (
        <GridView rows={paged} onOpen={(id) => setMode({ kind: "detail", id })} selected={selected} onToggle={toggleOne} />
      ) : (
        <ListView rows={paged} onOpen={(id) => setMode({ kind: "detail", id })} selected={selected} onToggle={toggleOne} />
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <span className="text-foreground font-medium">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</span> of {filtered.length}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="grid place-items-center h-7 w-7 rounded-md border border-border bg-surface disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2">{page} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}
              className="grid place-items-center h-7 w-7 rounded-md border border-border bg-surface disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// =================== Subviews ===================

function BulkBtn({ icon: I, label, onClick, danger }: { icon: typeof Check; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium hover:bg-surface-2 transition ${danger ? "text-danger hover:text-danger" : ""}`}>
      <I className="h-3 w-3" /> {label}
    </button>
  );
}

function TableView({
  rows, selected, allChecked, onToggle, onToggleAll, onOpen,
}: {
  rows: CrudRecord[]; selected: Set<string>; allChecked: boolean;
  onToggle: (id: string) => void; onToggleAll: () => void;
  onOpen: (id: string) => void;
}) {
  const amount = useAmount();
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-8">
                <input type="checkbox" checked={allChecked} onChange={onToggleAll} className="accent-[oklch(0.6_0.2_265)]" />
              </th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Owner</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">{amount.kind === "none" ? "" : amount.label}</th>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-right font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-surface/50">
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} className="accent-[oklch(0.6_0.2_265)]" />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => onOpen(r.id)} className="font-medium text-left hover:text-brand transition">{r.name}</button>
                  {r.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.tags.slice(0, 3).map((t) => (
                        <span key={t} className="inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2"><StatusPill s={r.status} /></td>
                <td className="px-3 py-2 text-muted-foreground">{r.owner}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{amount.kind === "none" ? "" : fmtAmount(r, amount.kind)}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(r.date)}</td>
                <td className="px-3 py-2 text-right">
                  <RowMenu onView={() => onOpen(r.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowMenu({ onView }: { onView: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)}
        className="grid place-items-center h-7 w-7 rounded-md border border-border bg-surface hover:bg-surface-2">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg p-1 text-xs">
          <MenuItem icon={Eye} label="View details" onClick={() => { setOpen(false); onView(); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: I, label, onClick, danger }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2 transition ${danger ? "text-danger" : ""}`}>
      <I className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function GridView({ rows, onOpen, selected, onToggle }: { rows: CrudRecord[]; onOpen: (id: string) => void; selected: Set<string>; onToggle: (id: string) => void }) {
  const amount = useAmount();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-4 depth-3d hover:border-brand/50 group">
          <div className="flex items-start justify-between">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} className="accent-[oklch(0.6_0.2_265)]" />
            <StatusPill s={r.status} />
          </div>
          <button onClick={() => onOpen(r.id)} className="mt-2 block text-left w-full">
            <div className="font-semibold truncate group-hover:text-brand transition">{r.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">{r.category} · {r.owner}</div>
          </button>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-mono">{fmtAmount(r, amount.kind)}</span>
            <span className="text-muted-foreground">{fmtDate(r.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ rows, onOpen, selected, onToggle }: { rows: CrudRecord[]; onOpen: (id: string) => void; selected: Set<string>; onToggle: (id: string) => void }) {
  const amount = useAmount();
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
          <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} className="accent-[oklch(0.6_0.2_265)]" />
          <button onClick={() => onOpen(r.id)} className="flex-1 min-w-0 text-left">
            <div className="font-medium truncate">{r.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{r.owner} · {r.category} · {fmtDate(r.date)}</div>
          </button>
          <StatusPill s={r.status} />
          <span className="font-mono text-xs w-20 text-right">{fmtAmount(r, amount.kind)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: I, title, sub, primary, secondary,
}: {
  icon: typeof Inbox; title: string; sub: string;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card grid place-items-center text-center px-6 py-16">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted-foreground">
        <I className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-sm">{sub}</div>
      <div className="mt-5 flex items-center gap-2">
        {primary && (
          <button onClick={primary.onClick}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
            <Plus className="h-3.5 w-3.5" /> {primary.label}
          </button>
        )}
        {secondary && (
          <button onClick={secondary.onClick}
            className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}

// =============== Detail ===============

function DetailView({
  rec, singular, onExport,
}: {
  rec: CrudRecord; singular: string;
  onExport: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "activity" | "comments" | "attachments" | "audit">("overview");
  const amount = useAmount();
  void singular;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Hero card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><StatusPill s={rec.status} /><span className="text-[11px] text-muted-foreground">#{rec.id.slice(0, 6)}</span></div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight truncate">{rec.name}</h2>
              <div className="mt-1 text-xs text-muted-foreground">Last updated {fmtDate(rec.date)}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              <PillBtn icon={Download} label="Export" onClick={onExport} />
              <PillBtn icon={Printer} label="Print" onClick={() => window.print()} />
              <PillBtn icon={Share2} label="Share" onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${rec.id}`); toast.success("Link copied"); }} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-1 border-b border-border px-2">
            {([
              ["overview", "Overview", FolderOpen],
              ["activity", "Activity", History],
              ["comments", `Comments (${rec.comments.length})`, MessageSquare],
              ["attachments", `Attachments (${rec.attachments.length})`, Paperclip],
              ["audit", "Audit log", ShieldCheck],
            ] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition ${tab === k ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <I className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Owner" icon={User} value={rec.owner} />
                <Field label="Category" icon={FolderOpen} value={rec.category} />
                <Field label={amount.label} icon={DollarSign} value={fmtAmount(rec, amount.kind)} mono />
                <Field label="Date" icon={Calendar} value={fmtDate(rec.date)} />
                <Field label="Status" icon={CheckCheck} value={rec.status} />
                <Field label="Tags" icon={Tag} value={rec.tags.length ? rec.tags.map((t) => `#${t}`).join(" ") : "—"} />
                <div className="md:col-span-2">
                  <div className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Notes</div>
                  <div className="rounded-lg border border-border bg-surface/50 px-3 py-2.5 text-sm whitespace-pre-wrap min-h-[60px]">
                    {rec.notes || <span className="text-muted-foreground italic">No notes yet.</span>}
                  </div>
                </div>
              </div>
            )}
            {tab === "activity" && (
              <Timeline items={rec.audit} empty="No activity yet." />
            )}
            {tab === "comments" && (
              <div className="space-y-3">
                {rec.comments.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No comments yet.</div>
                ) : rec.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-surface/50 px-3 py-2">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-between"><span className="font-medium text-foreground">{c.author}</span><span>{fmtDate(c.date)}</span></div>
                    <div className="text-sm mt-0.5">{c.text}</div>
                  </div>
                ))}
              </div>
            )}
            {tab === "attachments" && (
              <div className="space-y-3">
                {rec.attachments.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No attachments yet.</div>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {rec.attachments.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <FileJson className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{a.name}</span>
                        <span className="text-[11px] text-muted-foreground">{Math.round(a.size / 1024)} KB</span>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(a.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "audit" && (
              <Timeline items={rec.audit} empty="No audit entries." />
            )}
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick actions</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <QuickAction icon={Download} label="Export" onClick={onExport} />
            <QuickAction icon={Printer} label="Print" onClick={() => window.print()} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Related</div>
          <div className="mt-3 space-y-1.5 text-xs">
            <RelatedItem label={`Other ${singular.toLowerCase()}s in ${rec.category}`} hint="Scoped by category" />
            <RelatedItem label={`Owned by ${rec.owner}`} hint="Same owner" />
            <RelatedItem label="Tagged similarly" hint={rec.tags.length ? rec.tags.map(t => `#${t}`).join(" ") : "no tags"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PillBtn({ icon: I, label, onClick, danger }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium hover:bg-surface-2 transition ${danger ? "text-danger" : ""}`}>
      <I className="h-3 w-3" /> {label}
    </button>
  );
}

function QuickAction({ icon: I, label, onClick }: { icon: typeof Eye; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-2 text-xs font-medium hover:bg-surface-2 transition justify-center">
      <I className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function RelatedItem({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface/50 px-2.5 py-2">
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function Field({ label, icon: I, value, mono }: { label: string; icon: typeof Eye; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-1 inline-flex items-center gap-1"><I className="h-3 w-3" /> {label}</div>
      <div className={`rounded-lg border border-border bg-surface/50 px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Timeline({ items, empty }: { items: { id: string; action: string; by: string; date: string; detail?: string }[]; empty: string }) {
  if (items.length === 0) return <div className="text-xs text-muted-foreground italic">{empty}</div>;
  return (
    <ol className="relative border-s border-border ml-2 space-y-3">
      {items.map((a) => (
        <li key={a.id} className="ms-4">
          <div className="absolute -start-1.5 mt-1 h-3 w-3 rounded-full border border-border bg-card" />
          <div className="text-xs font-medium capitalize">{a.action} <span className="text-muted-foreground font-normal">by {a.by}</span></div>
          {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
          <div className="text-[10px] text-muted-foreground">{new Date(a.date).toLocaleString()}</div>
        </li>
      ))}
    </ol>
  );
}
