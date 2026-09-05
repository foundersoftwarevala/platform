import { useMemo } from "react";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAgents, useLeads, useSources } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { SOURCE_FILTERS } from "@/lib/lead-manager/nav";
import type { Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, StatCard, inr, num } from "../shared";
import { useAction } from "./common";

export function SourcesScreen({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (lead: Lead) => void;
}) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const { data: sources = [] } = useSources();
  const run = useAction();

  const filter = SOURCE_FILTERS[section];
  const rows = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!filter?.source || l.source === filter.source) &&
          (!filter?.subSource || l.sub_source === filter.subSource),
      ),
    [leads, filter],
  );

  const breakdown = useMemo(() => {
    const map = new Map<string, { total: number; won: number; value: number }>();
    for (const l of leads) {
      const e = map.get(l.source) ?? { total: 0, won: 0, value: 0 };
      e.total += 1;
      if (l.status === "won") {
        e.won += 1;
        e.value += l.deal_value ?? 0;
      }
      map.set(l.source, e);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [leads]);

  const subBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of rows) map.set(l.sub_source, (map.get(l.sub_source) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const won = rows.filter((l) => l.status === "won");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads from this source" value={num(rows.length)} icon={Globe} />
        <StatCard label="Won" value={num(won.length)} tone="success" />
        <StatCard
          label="Conversion"
          value={`${rows.length ? ((won.length / rows.length) * 100).toFixed(1) : "0.0"}%`}
          tone="info"
        />
        <StatCard label="Revenue" value={inr(won.reduce((a, l) => a + (l.deal_value ?? 0), 0))} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Source performance" description="Every channel measured on volume, wins and revenue.">
          <div className="space-y-3">
            {breakdown.map(([src, e]) => {
              const pct = leads.length ? Math.round((e.total / leads.length) * 100) : 0;
              return (
                <div key={src}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{src}</span>
                    <span className="text-muted-foreground">
                      {e.total} leads • {e.won} won • {inr(e.value)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Sub-source split" description={filter?.label ?? "All sources"}>
          <div className="space-y-2">
            {subBreakdown.map(([sub, count]) => (
              <div key={sub} className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                <span>{sub}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
            {subBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No captures recorded on this channel yet.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Source registry" description="Enable or pause a capture channel — changes are written to the database.">
        <div className="grid gap-3 md:grid-cols-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-2 p-3">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.type} • {(s.sub_sources as string[] | null)?.join(", ") || "No sub-sources"}
                </p>
                {s.utm_source ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    utm_source={s.utm_source} • utm_medium={s.utm_medium}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={s.is_active}
                onCheckedChange={(v) => run(() => leadApi.toggleSource(s.id, v), `${s.name} ${v ? "enabled" : "paused"}`)}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`${filter?.label ?? "All sources"} — ${rows.length} leads`}>
        <LeadTable
          leads={rows}
          agents={agents}
          isLoading={isLoading}
          onSelect={onSelect}
          columns={["source", "status", "agent", "score", "value", "created"]}
        />
      </Panel>
    </div>
  );
}
