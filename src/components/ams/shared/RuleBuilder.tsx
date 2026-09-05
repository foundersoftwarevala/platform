import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnlockCondition } from "@/lib/ams/types";

const uid = () => Math.random().toString(36).slice(2);
const OPS: UnlockCondition["operator"][] = [">=", ">", "=", "<", "<="];

export function RuleBuilder({
  value, onChange, metricPlaceholder = "metric.path",
}: {
  value: UnlockCondition[];
  onChange: (next: UnlockCondition[]) => void;
  metricPlaceholder?: string;
}) {
  const [rows, setRows] = useState<UnlockCondition[]>(value);
  const update = (next: UnlockCondition[]) => { setRows(next); onChange(next); };
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          No conditions. Awards without conditions can be manually granted only.
        </div>
      )}
      {rows.map((row, i) => (
        <div key={row.id} className="grid grid-cols-[1fr_90px_1fr_auto] gap-2">
          <Input
            value={row.metric}
            placeholder={metricPlaceholder}
            onChange={(e) => update(rows.map((r) => r.id === row.id ? { ...r, metric: e.target.value } : r))}
          />
          <Select value={row.operator} onValueChange={(v) => update(rows.map((r) => r.id === row.id ? { ...r, operator: v as UnlockCondition["operator"] } : r))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OPS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            value={String(row.value)}
            placeholder="value"
            onChange={(e) => update(rows.map((r) => r.id === row.id ? { ...r, value: e.target.value } : r))}
          />
          <Button variant="ghost" size="icon" title="Remove rule" aria-label="Remove rule" onClick={() => update(rows.filter((r) => r.id !== row.id))}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          {i < rows.length - 1 && (
            <div className="col-span-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AND</div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => update([...rows, { id: uid(), metric: "", operator: ">=", value: 0 }])} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add condition
      </Button>
    </div>
  );
}
