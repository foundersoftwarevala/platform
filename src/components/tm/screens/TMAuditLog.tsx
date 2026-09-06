import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime, titleCase } from "@/lib/tm/format";
import { useActivity } from "@/lib/tm/hooks";
import { TMEmpty, TMLoading, TMPageHeader, TMPanel } from "../shared";

export function TMAuditLog() {
  const { data: activity, isLoading } = useActivity();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const types = useMemo(() => [...new Set((activity ?? []).map((a) => a.action_type))].sort(), [activity]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (activity ?? []).filter((entry) => {
      if (type !== "all" && entry.action_type !== type) return false;
      if (!term) return true;
      return (
        entry.action.toLowerCase().includes(term) ||
        entry.actor_name.toLowerCase().includes(term) ||
        (entry.details ?? "").toLowerCase().includes(term)
      );
    });
  }, [activity, query, type]);

  if (isLoading) return <TMLoading label="Loading audit log" />;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Audit Log" subtitle="Immutable trail of every task action" actions={<Badge variant="outline">{rows.length} entries</Badge>} />

      <TMPanel title="Filters" icon={<FileText className="h-4 w-4" />}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, actor or details" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All action types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </TMPanel>

      <TMPanel title="Trail">
        <div className="space-y-2">
          {rows.map((entry) => (
            <div key={entry.id} className="rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{entry.action}</p>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {entry.actor_name} ({titleCase(entry.actor_role)}) • {titleCase(entry.action_type)}
                {entry.from_value || entry.to_value ? ` • ${entry.from_value ?? "—"} → ${entry.to_value ?? "—"}` : ""}
              </p>
              {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
            </div>
          ))}
          {rows.length === 0 && <TMEmpty message="No audit entries match" />}
        </div>
      </TMPanel>
    </div>
  );
}
