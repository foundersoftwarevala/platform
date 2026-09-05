import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  useAgents,
  useAssignments,
  useLeads,
  useRoutingRules,
} from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, StatCard, num, relTime } from "../shared";
import { agentNameMap, leadNameMap, useAction } from "./common";

export function CaptureScreen({ onSelect }: { onSelect: (lead: Lead) => void }) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const { data: rules = [] } = useRoutingRules();
  const { data: assignments = [] } = useAssignments();
  const run = useAction();

  const closed = new Set(["won", "lost", "spam"]);
  const openLeads = leads.filter((l) => !closed.has(l.status));
  const unassigned = openLeads.filter((l) => !l.assigned_agent_id);

  const load = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of openLeads) if (l.assigned_agent_id) map.set(l.assigned_agent_id, (map.get(l.assigned_agent_id) ?? 0) + 1);
    return map;
  }, [openLeads]);

  const geo = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const key = l.state ?? l.country;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [leads]);

  const product = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) map.set(l.industry, (map.get(l.industry) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const agentNames = agentNameMap(agents);
  const leadNames = leadNameMap(leads);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open leads" value={num(openLeads.length)} icon={GitBranch} />
        <StatCard label="Awaiting routing" value={num(unassigned.length)} tone="warning" />
        <StatCard label="Active routing rules" value={num(rules.filter((r) => r.is_active).length)} tone="info" />
        <StatCard label="Agents online" value={num(agents.filter((a) => a.status === "online").length)} tone="success" />
      </div>

      <Panel
        title="Routing rules"
        description="Rules run against every incoming lead. Toggling a rule updates the routing engine immediately."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-2 p-3">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Strategy: {r.strategy.replace(/_/g, " ")} • Target: {r.target_team} • {num(r.execution_count)} executions
                </p>
              </div>
              <Switch
                checked={r.is_active}
                onCheckedChange={(v) =>
                  run(() => leadApi.toggleRoutingRule(r.rule_key, v), `${r.name} ${v ? "activated" : "paused"}`)
                }
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Load balancing (team wise)" description="Open leads per agent against configured capacity.">
          <div className="space-y-3">
            {agents.map((a) => {
              const current = load.get(a.id) ?? 0;
              const pct = Math.min(100, Math.round((current / a.capacity) * 100));
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {a.name} <span className="text-xs text-muted-foreground">• {a.team}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {current}/{a.capacity} • {a.status}
                    </span>
                  </div>
                  <Progress value={pct} className="mt-1 h-2" />
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Country / state / city routing" description="Top geographies feeding the pipeline.">
            <div className="space-y-2">
              {geo.map(([place, count]) => (
                <div key={place} className="flex items-center justify-between text-sm">
                  <span>{place}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Product-based routing" description="Industry buckets mapped to specialist teams.">
            <div className="flex flex-wrap gap-2">
              {product.map(([ind, count]) => (
                <Badge key={ind} variant="outline" className="capitalize">
                  {ind.replace(/_/g, " ")} • {count}
                </Badge>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title={`Failover queue — ${unassigned.length} unrouted leads`}
        description="Leads with no owner. Auto-route picks the online agent with the most spare capacity and the best conversion rate."
        actions={
          <Button
            size="sm"
            disabled={unassigned.length === 0}
            onClick={() =>
              run(
                () => leadApi.bulkAutoAssign(unassigned.slice(0, 25).map((l) => l.id)),
                "Unrouted leads distributed",
              )
            }
          >
            Auto-route all
          </Button>
        }
      >
        <LeadTable
          leads={unassigned}
          agents={agents}
          isLoading={isLoading}
          onSelect={onSelect}
          emptyTitle="Every open lead has an owner"
          columns={["source", "status", "priority", "score", "value", "created"]}
        />
      </Panel>

      <Panel title="Recent assignments" description="Audit trail of the routing engine.">
        <div className="space-y-2">
          {assignments.slice(0, 12).map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
              <span>
                {leadNames.get(a.lead_id) ?? "Lead"} →{" "}
                <span className="font-medium">{agentNames.get(a.agent_id ?? "") ?? "Unassigned"}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {a.auto_assigned ? "Auto" : "Manual"} • {a.reason ?? "—"} • {relTime(a.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
