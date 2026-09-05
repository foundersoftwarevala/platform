import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  type StatTone,
} from "@/components/marketing/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toNum } from "@/lib/marketing/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  recordAudit,
  tableQuery,
  useCreateRow,
  useDeleteRow,
  useUpdateRow,
  type MarketingTable,
  type OrderSpec,
  type Row,
} from "@/lib/marketing/api";
import { buildCsv, csvFilename, downloadCsv } from "@/lib/marketing/csv";


/* eslint-disable @typescript-eslint/no-explicit-any */

export type FieldKind = "text" | "textarea" | "number" | "date" | "datetime" | "select" | "tags";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
};

export type ColumnDef<R> = {
  key: string;
  header: string;
  render: (row: R) => ReactNode;
  align?: "right" | "left";
};

export type StatDef<R> = {
  label: string;
  icon: LucideIcon;
  tone?: StatTone;
  value: (rows: R[]) => string;
  sublabel?: (rows: R[]) => string;
};

const toLocalInput = (v: unknown) =>
  v ? new Date(String(v)).toISOString().slice(0, 16) : "";

function defaultsFor(fields: FieldDef[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.kind === "number") out[f.key] = 0;
    else if (f.kind === "select") out[f.key] = f.options?.[0] ?? "";
    else if (f.kind === "tags") out[f.key] = "";
    else if (f.kind === "date") out[f.key] = new Date().toISOString().slice(0, 10);
    else out[f.key] = "";
  }
  return out;
}

function rowToForm(row: any, fields: FieldDef[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const v = row[f.key];
    if (f.kind === "number") out[f.key] = toNum(v);
    else if (f.kind === "tags") out[f.key] = Array.isArray(v) ? v.join(", ") : (v ?? "");
    else if (f.kind === "datetime") out[f.key] = toLocalInput(v);
    else out[f.key] = v ?? "";
  }
  return out;
}

function formToPayload(form: Record<string, any>, fields: FieldDef[]) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const v = form[f.key];
    if (f.kind === "number") out[f.key] = toNum(v);
    else if (f.kind === "tags")
      out[f.key] = String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (f.kind === "datetime") out[f.key] = v ? new Date(String(v)).toISOString() : null;
    else out[f.key] = v === "" ? null : v;
  }
  return out;
}

function compareValues(a: unknown, b: unknown) {
  const an = toNum(a);
  const bn = toNum(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && a !== null && b !== null && a !== "" && b !== "")
    return an - bn;
  const as = String(a ?? "");
  const bs = String(b ?? "");
  const ad = Date.parse(as);
  const bd = Date.parse(bs);
  if (!Number.isNaN(ad) && !Number.isNaN(bd)) return ad - bd;
  return as.localeCompare(bs);
}

const PAGE_SIZE = 25;


export function FieldEditor({
  fields,
  value,
  onChange,
}: {
  fields: FieldDef[];
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className={`space-y-1.5 ${f.full ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={`fld-${f.key}`}>{f.label}</Label>
          {f.kind === "select" ? (
            <Select value={String(value[f.key] ?? "")} onValueChange={(v) => set(f.key, v)}>
              <SelectTrigger id={`fld-${f.key}`}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {(f.options ?? []).map((o) => (
                  <SelectItem key={o} value={o} className="capitalize">
                    {o.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.kind === "textarea" ? (
            <Textarea
              id={`fld-${f.key}`}
              value={String(value[f.key] ?? "")}
              placeholder={f.placeholder ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              rows={4}
            />
          ) : (
            <Input
              id={`fld-${f.key}`}
              type={
                f.kind === "number"
                  ? "number"
                  : f.kind === "date"
                    ? "date"
                    : f.kind === "datetime"
                      ? "datetime-local"
                      : "text"
              }
              value={String(value[f.key] ?? "")}
              placeholder={f.placeholder ?? (f.kind === "tags" ? "comma, separated" : "")}
              onChange={(e) =>
                set(f.key, f.kind === "number" ? toNum(e.target.value) : e.target.value)
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function DataScreen<T extends MarketingTable>({
  table,
  title,
  description,
  module,
  entityLabel,
  order,
  columns,
  fields,
  stats,
  searchKeys,
  filterKey,
  filterOptions,
  minWidth = 1000,
  extra,
  headless,
}: {
  table: T;
  title: string;
  description: string;
  module: string;
  entityLabel: string;
  order?: OrderSpec;
  columns: ColumnDef<Row<T>>[];
  fields: FieldDef[];
  stats?: StatDef<Row<T>>[];
  searchKeys: string[];
  filterKey?: string;
  filterOptions?: readonly string[];
  minWidth?: number;
  extra?: (rows: Row<T>[]) => ReactNode;
  headless?: boolean;
}) {
  const query = useQuery(tableQuery(table, order));
  const create = useCreateRow(table);
  const update = useUpdateRow(table);
  const remove = useDeleteRow(table);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, any>>(() => defaultsFor(fields));
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const allRows = (query.data ?? []) as any[];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allRows.filter((r) => {
      const matchesTerm =
        !term ||
        searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(term));
      const matchesFilter = filter === "all" || !filterKey || String(r[filterKey]) === filter;
      return matchesTerm && matchesFilter;
    });
    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => compareValues(a[sort.key], b[sort.key]));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [allRows, search, filter, filterKey, searchKeys, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [rows, safePage],
  );

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" },
    );
  };


  const nameOf = (row: any) =>
    String(row.name ?? row.title ?? row.keyword ?? row.item ?? row.full_name ?? row.url ?? row.id);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultsFor(fields));
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm(rowToForm(row, fields));
    setOpen(true);
  };

  const submit = () => {
    const missing = fields.find((f) => f.required && !String(form[f.key] ?? "").trim());
    if (missing) {
      toast.error(`${missing.label} is required.`);
      return;
    }
    const payload = formToPayload(form, fields);
    if (editing) {
      update.mutate(
        { id: editing.id, values: payload as any },
        {
          onSuccess: (row) => {
            toast.success(`${entityLabel} updated.`);
            setOpen(false);
            void recordAudit({
              actor: "Marketing Manager",
              action: "update",
              entity_type: entityLabel,
              entity_id: (row as any).id,
              entity_name: nameOf(row),
              module,
            });
          },
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      create.mutate(payload as any, {
        onSuccess: (row) => {
          toast.success(`${entityLabel} created.`);
          setOpen(false);
          void recordAudit({
            actor: "Marketing Manager",
            action: "create",
            entity_type: entityLabel,
            entity_id: (row as any).id,
            entity_name: nameOf(row),
            module,
          });
        },
        onError: (e) => toast.error(e.message),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    remove.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${entityLabel} deleted.`);
        setDeleteTarget(null);
        void recordAudit({
          actor: "Marketing Manager",
          action: "delete",
          entity_type: entityLabel,
          entity_id: target.id,
          entity_name: nameOf(target),
          module,
        });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const exportCsv = async () => {
    const csv = buildCsv(rows);
    if (!csv) {
      toast.error("Nothing to export.");
      return;
    }
    await recordAudit({
      actor: "Marketing Manager",
      action: "export",
      entity_type: entityLabel,
      entity_name: `${rows.length} rows`,
      module,
      details: `Exported ${rows.length} ${entityLabel.toLowerCase()} rows to CSV`,
    });
    downloadCsv(csvFilename(String(table)), csv);
    toast.success(`Exported ${rows.length} rows.`);
  };


  return (
    <div className="space-y-6">
      {headless ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void exportCsv()}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New {entityLabel}
          </Button>
        </div>
      ) : (
        <ScreenHeader
          title={title}
          description={description}
          actions={
            <>
              <Button variant="outline" onClick={() => void exportCsv()}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> New {entityLabel}
              </Button>
            </>
          }
        />
      )}


      {stats && stats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value(allRows as Row<T>[])}
              {...(s.sublabel ? { sublabel: s.sublabel(allRows as Row<T>[]) } : {})}
              icon={s.icon}
              tone={s.tone ?? "violet"}
              index={i}
            />
          ))}
        </div>
      ) : null}

      {extra ? extra(allRows as Row<T>[]) : null}

      <SectionCard
        title={`${title} records`}
        description={`${rows.length} of ${allRows.length} shown`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search…"
                className="w-52 pl-8"
              />
            </div>
            {filterKey && filterOptions ? (
              <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(0); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filterOptions.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">
                      {o.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        }
      >
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          data={pageRows}
          emptyMessage={`No ${entityLabel.toLowerCase()} records match your filters.`}
        >
          {(list) => (
            <div className="overflow-x-auto">
              <Table style={{ minWidth }}>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {c.header}
                          <ArrowUpDown
                            className={`h-3 w-3 ${sort?.key === c.key ? "opacity-100" : "opacity-30"}`}
                          />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row: any) => (

                    <TableRow key={row.id}>
                      {columns.map((c) => (
                        <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                          {c.render(row)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(row)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        {rows.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
            <span>
              Showing {safePage * PAGE_SIZE + 1}–{Math.min(rows.length, (safePage + 1) * PAGE_SIZE)}{" "}
              of {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>
                Page {safePage + 1} / {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${entityLabel}` : `New ${entityLabel}`}
            </DialogTitle>
            <DialogDescription>
              Changes are saved to the live marketing database and written to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <FieldEditor fields={fields} value={form} onChange={setForm} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {editing ? "Save changes" : `Create ${entityLabel}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? nameOf(deleteTarget) : ""} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
