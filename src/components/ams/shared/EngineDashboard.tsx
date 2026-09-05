import { type ReactNode, useMemo, useState } from "react";
import {
  Search, Plus, Download, Upload, Copy, Archive, Trash2, Check, Filter,
  MoreHorizontal, TrendingUp, TrendingDown, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ams/shared/PageHeader";


export interface KpiCard {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down";
  accent?: string;
}

export interface DashboardRow {
  id: string;
  [k: string]: ReactNode;
}

export interface DashboardColumn {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
}

export interface FilterChip {
  label: string;
  values: string[];
}

export interface EngineDashboardProps {
  kicker: string;
  title: string;
  description?: string;
  primaryAction?: string;
  kpis: KpiCard[];
  filters?: FilterChip[];
  columns: DashboardColumn[];
  rows: DashboardRow[];
  emptyLabel?: string;
  extraPanels?: ReactNode;
}

export function EngineDashboard({
  kicker, title, description, primaryAction = "New",
  kpis, filters = [], columns, rows,
  emptyLabel = "No records yet — create your first entry.",
  extraPanels,
}: EngineDashboardProps) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = Object.values(r).map((v) => String(v ?? "")).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      for (const [k, v] of Object.entries(active)) {
        if (v && String(r[k] ?? "").toLowerCase() !== v.toLowerCase()) return false;
      }
      return true;
    });
  }, [rows, q, active]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));
  };

  return (
    <div className="space-y-6">
      {/* Banner header */}
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <>
            <Button variant="outline" size="sm" sound="importComplete" className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</Button>
            <Button variant="outline" size="sm" sound="exportComplete" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> {primaryAction}</Button>
          </>
        }
      />


      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="surface-card motion-card motion-fade p-4">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{k.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-bold tracking-tight" style={{ color: k.accent }}>{k.value}</div>
              {k.delta && (
                <span className={cn(
                  "text-[11px] flex items-center gap-0.5",
                  k.trend === "down" ? "text-destructive" : "text-emerald-500",
                )}>
                  {k.trend === "down" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {k.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {extraPanels}

      {/* Filter + search bar */}
      <div className="surface-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9 bg-muted/30" />
        </div>
        {filters.map((f) => (
          <DropdownMenu key={f.label}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {f.label}{active[f.label.toLowerCase()] ? `: ${active[f.label.toLowerCase()]}` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44">
              <DropdownMenuItem onClick={() => setActive((a) => ({ ...a, [f.label.toLowerCase()]: "" }))}>
                All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {f.values.map((v) => (
                <DropdownMenuItem key={v} onClick={() => setActive((a) => ({ ...a, [f.label.toLowerCase()]: v }))}>
                  {v}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground mr-2">{selected.size} selected</span>
              <Button variant="ghost" size="sm" sound="approval" className="gap-1.5"><Check className="h-3.5 w-3.5" /> Activate</Button>
              <Button variant="ghost" size="sm" className="gap-1.5"><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
              <Button variant="ghost" size="sm" sound="archive" className="gap-1.5"><Archive className="h-3.5 w-3.5" /> Archive</Button>
              <Button variant="ghost" size="sm" sound="delete" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-border/60 bg-[oklch(0.2_0.032_260)] backdrop-blur text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <th scope="col" className="w-10 px-3 py-2 text-left">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </th>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right", c.align === "center" && "text-center")} style={{ width: c.width }}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="px-3 py-16 text-center">
                    <div className="motion-fade mx-auto flex max-w-sm flex-col items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
                        <Filter className="h-5 w-5" />
                      </span>
                      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                      <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> {primaryAction}</Button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <tr
                  key={r.id}
                  data-selected={selected.has(r.id) || undefined}
                  className="motion-row border-b border-border/40 hover:bg-muted/25 data-[selected]:bg-trophy/5"
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Select row ${r.id}`}
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-3 py-2.5", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                      {r[c.key]}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Row actions" sound="dropdown">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Row actions</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem><ArrowUpRight className="h-3.5 w-3.5 mr-2" /> View</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem><Copy className="h-3.5 w-3.5 mr-2" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem><Archive className="h-3.5 w-3.5 mr-2" /> Archive</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div>Showing {filtered.length} of {rows.length}</div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled>Prev</Button>
            <Button variant="ghost" size="sm" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusChip({ tone, children }: { tone: "success" | "warn" | "info" | "muted" | "danger"; children: ReactNode }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    warn:    "bg-amber-500/10 text-amber-500 border-amber-500/30",
    info:    "bg-sky-500/10 text-sky-500 border-sky-500/30",
    muted:   "bg-muted/40 text-muted-foreground border-border",
    danger:  "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", map[tone])}>{children}</Badge>;
}
