import { useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  AWARD_CATEGORIES, RARITIES, DEPARTMENTS,
  type AwardFilters,
} from "@/lib/ams/types";


const STATUSES = ["draft", "pending", "approved", "rejected", "published", "unpublished", "archived", "disabled"] as const;
const TYPES = ["trophy", "badge", "achievement", "rank", "milestone", "streak"] as const;
const VISIBILITIES = ["public", "private", "role-restricted", "module-restricted"] as const;

export function FilterBar({
  value, onChange,
}: {
  value: AwardFilters;
  onChange: (next: AwardFilters) => void;
}) {
  const [local, setLocal] = useState(value);
  const apply = (patch: Partial<AwardFilters>) => {
    const next = { ...local, ...patch };
    setLocal(next); onChange(next);
  };
  const clear = () => { setLocal({}); onChange({}); };
  const activeCount =
    Object.values(local).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={local.search ?? ""}
          onChange={(e) => apply({ search: e.target.value || undefined })}
          placeholder="Search by name or description…"
          className="pl-9 bg-muted/30"
        />
      </div>

      <Select value={local.category ?? "_all"} onValueChange={(v) => apply({ category: v === "_all" ? undefined : (v as AwardFilters["category"]) })}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All categories</SelectItem>
          {AWARD_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={local.rarity ?? "_all"} onValueChange={(v) => apply({ rarity: v === "_all" ? undefined : (v as AwardFilters["rarity"]) })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Rarity" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All rarities</SelectItem>
          {RARITIES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={local.status ?? "_all"} onValueChange={(v) => apply({ status: v === "_all" ? undefined : (v as AwardFilters["status"]) })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" /> More
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-trophy/20 text-trophy px-1.5 py-0.5 text-[10px] font-semibold">{activeCount}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</Label>
            <Select value={local.type ?? "_all"} onValueChange={(v) => apply({ type: v === "_all" ? undefined : (v as AwardFilters["type"]) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All types</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Department</Label>
            <Select value={local.department ?? "_all"} onValueChange={(v) => apply({ department: v === "_all" ? undefined : (v as AwardFilters["department"]) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Visibility</Label>
            <Select value={local.visibility ?? "_all"} onValueChange={(v) => apply({ visibility: v === "_all" ? undefined : (v as AwardFilters["visibility"]) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All visibilities</SelectItem>
                {VISIBILITIES.map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Min XP</Label>
              <Input type="number" min={0} value={local.minXp ?? ""} onChange={(e) => apply({ minXp: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Module</Label>
              <Input value={local.module ?? ""} onChange={(e) => apply({ module: e.target.value || undefined })} placeholder="e.g. sales" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input type="date" value={local.from ?? ""} onChange={(e) => apply({ from: e.target.value || undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input type="date" value={local.to ?? ""} onChange={(e) => apply({ to: e.target.value || undefined })} />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground gap-1">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
