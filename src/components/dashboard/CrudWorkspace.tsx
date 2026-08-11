import { useCallback, useMemo, useState, useEffect, useRef, createContext, useContext } from "react";
import {
  ArrowLeft, Plus, Search, Filter, Download, Upload, Trash2, Copy,
  Archive, ArchiveRestore, Check, X, Eye, Pencil, MoreHorizontal,
  LayoutGrid, List as ListIcon, Table as TableIcon, ChevronLeft, ChevronRight,
  CheckCheck, RotateCcw, FileJson, FileText, Printer, Share2, Paperclip,
  MessageSquare, History, ShieldCheck, Inbox, AlertTriangle, Tag, Calendar,
  DollarSign, User, FolderOpen, Clock, ListChecks,
} from "lucide-react";
import { can, type Capability } from "@/lib/permissions";
import { toast } from "sonner";
import type { RoleConfig } from "@/lib/roles";
import { useCrud, exportJson, downloadFile, type CrudRecord, type RecordStatus } from "@/lib/crud-store";

type View = "table" | "grid" | "list";
type Mode = { kind: "list" } | { kind: "detail"; id: string } | { kind: "add" } | { kind: "edit"; id: string };

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

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

const CapContext = createContext<(cap: Capability) => boolean>(() => true);
const useCap = () => useContext(CapContext);

type CrudProps = { role: RoleConfig; moduleKey: string; onBack: () => void };

export function CrudWorkspace(props: CrudProps) {
  const cap = useCallback((c: Capability) => can(props.role.key, c), [props.role.key]);
  return (
    <CapContext.Provider value={cap}>
      <CrudWorkspaceInner {...props} />
    </CapContext.Provider>
  );
}

function CrudWorkspaceInner({ role, moduleKey, onBack }: CrudProps) {
  const allow = (cap: Capability) => can(role.key, cap);
  const mod = role.modules.find((m) => m.key === moduleKey) ?? { key: moduleKey, label: moduleKey, icon: Inbox };
  const Icon = mod.icon;
  const singular = mod.label.replace(/s$/, "") || mod.label;

  const crud = useCrud(role.key, moduleKey);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc" | "amount_desc">("date_desc");
  const [view, setView] = useState<View>("table");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);
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
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const n = crud.importJson(String(reader.result || ""));
      toast[n > 0 ? "success" : "error"](n > 0 ? `Imported ${n} record${n === 1 ? "" : "s"}` : "Import failed: invalid JSON");
    };
    reader.readAsText(f);
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
            {mode.kind === "add" && <><span>/</span><span className="text-foreground">New {singular}</span></>}
            {mode.kind === "edit" && <><span>/</span><span className="text-foreground">Edit</span></>}
          </nav>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{mod.label}</h1>
        </div>
      </div>
    </div>
  );

  if (mode.kind === "add" || mode.kind === "edit") {
    return (
      <div className="space-y-5">
        {Header}
        <RecordForm
          singular={singular}
          initial={mode.kind === "edit" ? crud.records.find((r) => r.id === mode.id) : undefined}
          onCancel={() => setMode({ kind: "list" })}
          onSubmit={(values) => {
            if (mode.kind === "edit") {
              crud.update(mode.id, values);
              toast.success(`${singular} updated`);
              setMode({ kind: "detail", id: mode.id });
            } else {
              const rec = crud.create(values);
              toast.success(`${singular} created`);
              setMode({ kind: "detail", id: rec.id });
            }
          }}
        />
      </div>
    );
  }

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
          onEdit={() => setMode({ kind: "edit", id: rec.id })}
          onDuplicate={() => { const c = crud.duplicate(rec.id); if (c) { toast.success("Duplicated"); setMode({ kind: "detail", id: c.id }); } }}
          onArchive={() => { crud.setStatus(rec.id, rec.status === "archived" ? "active" : "archived"); toast.success(rec.status === "archived" ? "Restored" : "Archived"); }}
          onApprove={() => { crud.setStatus(rec.id, "approved"); toast.success("Approved"); }}
          onReject={() => { crud.setStatus(rec.id, "rejected"); toast.success("Rejected"); }}
          onDelete={() => setConfirm({ ids: [rec.id] })}
          onExport={() => handleExport([rec])}
          onComment={(text) => crud.addComment(rec.id, text)}
          onAttach={(name, size) => crud.addAttachment(rec.id, name, size)}
        />
        {confirm && (
          <ConfirmDialog
            title={`Delete ${confirm.ids.length === 1 ? "this " + singular.toLowerCase() : confirm.ids.length + " records"}?`}
            body="This action removes the record from this workspace. You can re-import it later."
            confirmLabel="Delete"
            onCancel={() => setConfirm(null)}
            onConfirm={() => {
              crud.bulkRemove(confirm.ids);
              toast.success("Deleted");
              setConfirm(null);
              setMode({ kind: "list" });
            }}
          />
        )}
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
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as RecordStatus | "all"); setPage(1); }}
          className="rounded-lg bg-surface border border-border px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
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
          {allow("reset_data") && <button onClick={() => { crud.reset(); toast.success("Reset to sample data"); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>}
          {allow("create") && <button onClick={() => setMode({ kind: "add" })}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">
            <Plus className="h-3.5 w-3.5" /> New {singular}
          </button>}
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
            {allow("approve") && <BulkBtn icon={Check} label="Approve" onClick={() => { crud.bulkSetStatus([...selected], "approved"); toast.success("Approved"); setSelected(new Set()); }} />}
            {allow("approve") && <BulkBtn icon={X} label="Reject" onClick={() => { crud.bulkSetStatus([...selected], "rejected"); toast.success("Rejected"); setSelected(new Set()); }} />}
            {allow("update") && <BulkBtn icon={Archive} label="Archive" onClick={() => { crud.bulkSetStatus([...selected], "archived"); toast.success("Archived"); setSelected(new Set()); }} />}
            {allow("update") && <BulkBtn icon={ArchiveRestore} label="Restore" onClick={() => { crud.bulkSetStatus([...selected], "active"); toast.success("Restored"); setSelected(new Set()); }} />}
            {allow("export") && <BulkBtn icon={Download} label="Export" onClick={() => { handleExport(crud.records.filter(r => selected.has(r.id))); }} />}
            {allow("delete") && <BulkBtn icon={Trash2} label="Delete" danger onClick={() => setConfirm({ ids: [...selected] })} />}
            <BulkBtn icon={X} label="Clear" onClick={() => setSelected(new Set())} />
          </div>
        </div>
      )}

      {/* Body: views */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`No ${mod.label.toLowerCase()} match your filters`}
          sub="Try clearing search, switching status, or create a new record."
          primary={allow("create") ? { label: `Create ${singular}`, onClick: () => setMode({ kind: "add" }) } : undefined}
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
          onEdit={(id) => setMode({ kind: "edit", id })}
          onDuplicate={(id) => { const c = crud.duplicate(id); if (c) toast.success("Duplicated"); }}
          onArchive={(id, s) => { crud.setStatus(id, s === "archived" ? "active" : "archived"); }}
          onDelete={(id) => setConfirm({ ids: [id] })}
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

      {confirm && (
        <ConfirmDialog
          title={`Delete ${confirm.ids.length === 1 ? "this " + singular.toLowerCase() : confirm.ids.length + " records"}?`}
          body="This removes the record(s) from this workspace. You can re-import them later from a JSON backup."
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            crud.bulkRemove(confirm.ids);
            toast.success(`Deleted ${confirm.ids.length}`);
            setSelected(new Set());
            setConfirm(null);
          }}
        />
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
  rows, selected, allChecked, onToggle, onToggleAll, onOpen, onEdit, onDuplicate, onArchive, onDelete,
}: {
  rows: CrudRecord[]; selected: Set<string>; allChecked: boolean;
  onToggle: (id: string) => void; onToggleAll: () => void;
  onOpen: (id: string) => void; onEdit: (id: string) => void;
  onDuplicate: (id: string) => void; onArchive: (id: string, s: RecordStatus) => void; onDelete: (id: string) => void;
}) {
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
              <th className="px-3 py-2 text-right font-medium">Amount</th>
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
                <td className="px-3 py-2 text-right font-mono text-xs">{fmtMoney(r.amount)}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(r.date)}</td>
                <td className="px-3 py-2 text-right">
                  <RowMenu
                    onView={() => onOpen(r.id)}
                    onEdit={() => onEdit(r.id)}
                    onDuplicate={() => onDuplicate(r.id)}
                    onArchive={() => onArchive(r.id, r.status)}
                    archived={r.status === "archived"}
                    onDelete={() => onDelete(r.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowMenu({ onView, onEdit, onDuplicate, onArchive, onDelete, archived }: {
  onView: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void; archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cap = useCap();
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
          {cap("update") && <MenuItem icon={Pencil} label="Edit" onClick={() => { setOpen(false); onEdit(); }} />}
          {cap("create") && <MenuItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); onDuplicate(); }} />}
          {cap("update") && <MenuItem icon={archived ? ArchiveRestore : Archive} label={archived ? "Restore" : "Archive"} onClick={() => { setOpen(false); onArchive(); }} />}
          {cap("delete") && <>
            <div className="my-1 h-px bg-border" />
            <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setOpen(false); onDelete(); }} />
          </>}
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
            <span className="font-mono">{fmtMoney(r.amount)}</span>
            <span className="text-muted-foreground">{fmtDate(r.date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ rows, onOpen, selected, onToggle }: { rows: CrudRecord[]; onOpen: (id: string) => void; selected: Set<string>; onToggle: (id: string) => void }) {
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
          <span className="font-mono text-xs w-20 text-right">{fmtMoney(r.amount)}</span>
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
  rec, singular, onEdit, onDuplicate, onArchive, onApprove, onReject, onDelete, onExport, onComment, onAttach,
}: {
  rec: CrudRecord; singular: string;
  onEdit: () => void; onDuplicate: () => void; onArchive: () => void;
  onApprove: () => void; onReject: () => void; onDelete: () => void;
  onExport: () => void; onComment: (text: string) => void; onAttach: (name: string, size: number) => void;
}) {
  const [tab, setTab] = useState<"overview" | "activity" | "comments" | "attachments" | "audit">("overview");
  const [comment, setComment] = useState("");
  const attachRef = useRef<HTMLInputElement>(null);

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
              <PillBtn icon={Pencil} label="Edit" onClick={onEdit} />
              <PillBtn icon={Copy} label="Duplicate" onClick={onDuplicate} />
              <PillBtn icon={rec.status === "archived" ? ArchiveRestore : Archive} label={rec.status === "archived" ? "Restore" : "Archive"} onClick={onArchive} />
              <PillBtn icon={Check} label="Approve" onClick={onApprove} />
              <PillBtn icon={X} label="Reject" onClick={onReject} />
              <PillBtn icon={Download} label="Export" onClick={onExport} />
              <PillBtn icon={Printer} label="Print" onClick={() => window.print()} />
              <PillBtn icon={Share2} label="Share" onClick={() => { navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${rec.id}`); toast.success("Link copied"); }} />
              <PillBtn icon={Trash2} label="Delete" danger onClick={onDelete} />
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
                <Field label="Amount" icon={DollarSign} value={fmtMoney(rec.amount)} mono />
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
                <form onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; onComment(comment.trim()); setComment(""); toast.success("Comment added"); }} className="flex gap-2">
                  <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…"
                    className="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <button type="submit" className="rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow">Post</button>
                </form>
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
                <input ref={attachRef} type="file" hidden onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  onAttach(f.name, f.size); toast.success("Attached"); e.target.value = "";
                }} />
                <button onClick={() => attachRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">
                  <Upload className="h-3.5 w-3.5" /> Upload file
                </button>
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
            <QuickAction icon={Pencil} label="Edit" onClick={onEdit} />
            <QuickAction icon={Copy} label="Clone" onClick={onDuplicate} />
            <QuickAction icon={Check} label="Approve" onClick={onApprove} />
            <QuickAction icon={X} label="Reject" onClick={onReject} />
            <QuickAction icon={Archive} label="Archive" onClick={onArchive} />
            <QuickAction icon={Download} label="Export" onClick={onExport} />
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

// =============== Form (Add/Edit) ===============

function RecordForm({
  singular, initial, onSubmit, onCancel,
}: {
  singular: string;
  initial?: CrudRecord;
  onSubmit: (values: Partial<CrudRecord>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState<RecordStatus>(initial?.status ?? "draft");
  const [owner, setOwner] = useState(initial?.owner ?? "you");
  const [category, setCategory] = useState(initial?.category ?? "Core");
  const [amount, setAmount] = useState<string>(String(initial?.amount ?? 0));
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsStr, setTagsStr] = useState((initial?.tags ?? []).join(", "));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Draft autosave (sessionStorage)
  const draftKey = `crud-draft:${initial?.id ?? "new"}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!initial && raw) {
        const d = JSON.parse(raw);
        setName(d.name ?? ""); setStatus(d.status ?? "draft"); setOwner(d.owner ?? "you");
        setCategory(d.category ?? "Core"); setAmount(String(d.amount ?? 0));
        setDate(d.date ?? new Date().toISOString().slice(0, 10));
        setNotes(d.notes ?? ""); setTagsStr(d.tagsStr ?? "");
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.setItem(draftKey, JSON.stringify({ name, status, owner, category, amount, date, notes, tagsStr })); setSavedAt(new Date().toLocaleTimeString()); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [name, status, owner, category, amount, date, notes, tagsStr, draftKey]);

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (name.length > 80) return "Name must be 80 characters or less.";
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return "Amount must be a non-negative number.";
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); toast.error(err); return; }
    setSubmitting(true); setError(null);
    const values: Partial<CrudRecord> = {
      name: name.trim(),
      status,
      owner: owner.trim(),
      category: category.trim(),
      amount: Number(amount),
      date: new Date(date).toISOString(),
      notes: notes.trim(),
      tags: tagsStr.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    };
    setTimeout(() => {
      onSubmit(values);
      try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
      setSubmitting(false);
    }, 150);
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
          <div>
            <Label>Name *</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              placeholder={`${singular} name`}
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="mt-1 text-[10px] text-muted-foreground">{name.length}/80</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as RecordStatus)}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Owner</Label>
              <input value={owner} onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Category</Label>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Amount (USD)</Label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="priority, vip"
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={1000}
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="mt-1 text-[10px] text-muted-foreground">{notes.length}/1000</div>
          </div>
          {error && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger inline-flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">{savedAt ? `Draft autosaved · ${savedAt}` : "Autosaving draft…"}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCancel}
                className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">Cancel</button>
              <button type="submit" disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand text-brand-foreground px-3 py-2 text-xs font-semibold shadow-glow disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> {submitting ? "Saving…" : initial ? "Save changes" : `Create ${singular}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live preview</div>
          <div className="mt-3 rounded-xl border border-border bg-surface/50 p-3">
            <div className="flex items-center justify-between">
              <StatusPill s={status} />
              <span className="text-[10px] text-muted-foreground">{date}</span>
            </div>
            <div className="mt-2 font-semibold truncate">{name || `New ${singular}`}</div>
            <div className="text-xs text-muted-foreground truncate">{category} · {owner}</div>
            <div className="mt-2 font-mono text-sm">{fmtMoney(Number(amount) || 0)}</div>
            {tagsStr && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tagsStr.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span key={t} className="inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">#{t.replace(/^#/, "")}</span>
                ))}
              </div>
            )}
          </div>
          <ul className="mt-3 text-[11px] text-muted-foreground space-y-1">
            <li className="flex items-center gap-1"><Check className="h-3 w-3 text-success" /> Required fields validated</li>
            <li className="flex items-center gap-1"><Check className="h-3 w-3 text-success" /> Draft autosaves to this session</li>
            <li className="flex items-center gap-1"><Check className="h-3 w-3 text-success" /> Creates an audit entry on save</li>
          </ul>
        </div>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-muted-foreground mb-1">{children}</div>;
}

// =============== Confirm dialog ===============

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-danger/15 text-danger">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{body}</div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-lg bg-surface border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2 transition">Cancel</button>
          <button onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-lg bg-danger text-white px-3 py-2 text-xs font-semibold hover:opacity-90">
            <Trash2 className="h-3.5 w-3.5" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
