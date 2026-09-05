import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Download, Check, Archive, Trash2, Send, EyeOff, X, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { AwardCard } from "@/components/ams/shared/AwardCard";
import {
  listAwards, bulkDelete, bulkSetStatus, bulkUpdate, createAward,
} from "@/lib/ams/awards.api";
import {
  toCSV, toJSON, fromCSV, fromJSON, downloadBlob,
} from "@/lib/ams/awards.io";
import { AWARD_CATEGORIES, type AwardCategory, type AwardType } from "@/lib/ams/types";
import { cn } from "@/lib/utils";

export function LibraryPage({
  type, kicker, title, description,
}: {
  type: AwardType; kicker: string; title: string; description: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["awards", { type }],
    queryFn: () => listAwards({ type }),
  });
  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["awards"] });
  const clearSel = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  async function handleBulk(action: "publish" | "unpublish" | "archive" | "approve" | "disable" | "delete") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      let n = 0;
      if (action === "delete") {
        if (!confirm(`Delete ${ids.length} ${type}(s)? This cannot be undone.`)) return;
        n = await bulkDelete(ids);
      } else {
        n = await bulkSetStatus(ids, action === "publish" ? "published"
          : action === "unpublish" ? "unpublished"
          : action === "archive" ? "archived"
          : action === "approve" ? "approved"
          : "disabled");
      }
      toast.success(`${n} ${type}${n === 1 ? "" : "s"} ${action}d`);
      clearSel(); refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    }
  }

  async function handleCategoryChange(category: AwardCategory) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const n = await bulkUpdate(ids, { category });
    toast.success(`${n} moved to ${category}`);
    clearSel(); refresh();
  }

  function exportRows(format: "csv" | "json", scope: "selected" | "all") {
    const source = scope === "selected" ? rows.filter((r) => selected.has(r.id)) : rows;
    if (source.length === 0) {
      toast.error(`No ${type}s to export`);
      return;
    }
    const ts = new Date().toISOString().slice(0, 10);
    if (format === "csv") downloadBlob(`${type}s-${ts}.csv`, toCSV(source), "text/csv");
    else downloadBlob(`${type}s-${ts}.json`, toJSON(source), "application/json");
    toast.success(`Exported ${source.length} ${type}${source.length === 1 ? "" : "s"}`);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const drafts = file.name.toLowerCase().endsWith(".json")
        ? fromJSON(text, type)
        : fromCSV(text, type);
      if (drafts.length === 0) {
        toast.error("No valid rows found in file");
        return;
      }
      let ok = 0;
      for (const d of drafts) {
        try { await createAward({ ...d, type }); ok++; } catch { /* skip */ }
      }
      toast.success(`Imported ${ok} of ${drafts.length} ${type}${drafts.length === 1 ? "" : "s"}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? `Import failed: ${e.message}` : "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export {someSelected ? `${selected.size} selected` : "all rows"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {someSelected && (
                  <>
                    <DropdownMenuItem onClick={() => exportRows("csv", "selected")}>Selected as CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportRows("json", "selected")}>Selected as JSON</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => exportRows("csv", "all")}>All as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("json", "all")}>All as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild size="sm" className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
              <Link to="/awards/new"><Plus className="h-4 w-4" /> New {type}</Link>
            </Button>
          </div>
        }
      />

      {/* Selection toolbar */}
      {rows.length > 0 && (
        <div className={cn(
          "surface-card flex flex-wrap items-center gap-2 px-3 py-2 transition-colors",
          someSelected && "border-trophy/50 shadow-glow-trophy",
        )}>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pr-2 border-r border-border">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            <span>{someSelected ? `${selected.size} of ${rows.length} selected` : `Select all (${rows.length})`}</span>
          </label>
          <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8" onClick={() => handleBulk("publish")}>
            <Send className="h-3.5 w-3.5" /> Publish
          </Button>
          <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8" onClick={() => handleBulk("approve")}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8" onClick={() => handleBulk("unpublish")}>
            <EyeOff className="h-3.5 w-3.5" /> Unpublish
          </Button>
          <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8" onClick={() => handleBulk("archive")}>
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8">
                <Tags className="h-3.5 w-3.5" /> Change category
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              {AWARD_CATEGORIES.map((c) => (
                <DropdownMenuItem key={c.value} onClick={() => handleCategoryChange(c.value)}>
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" disabled={!someSelected} className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => handleBulk("delete")}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          {someSelected && (
            <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={clearSel}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${type}s yet`}
          description={`Create your first ${type} in the Award Management Center, or import a CSV/JSON.`}
          action={
            <div className="flex gap-2 justify-center">
              <Button asChild className="gap-1.5"><Link to="/awards/new"><Plus className="h-4 w-4" /> Create</Link></Button>
              <Button variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((a) => (
            <div key={a.id} className="relative">
              <div
                className="absolute left-3 top-3 z-10"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(a.id); }}
              >
                <Checkbox
                  checked={selected.has(a.id)}
                  onCheckedChange={() => toggle(a.id)}
                  aria-label={`Select ${a.name}`}
                  className="bg-background/90 border-border shadow"
                />
              </div>
              <AwardCard
                award={a}
                className={cn(selected.has(a.id) && "ring-2 ring-trophy/60 shadow-glow-trophy")}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
