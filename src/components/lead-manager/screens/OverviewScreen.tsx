import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  Copy,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgents, useAlerts, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, StatCard, inr, num, relTime } from "../shared";
import { useAction } from "./common";

const DAY = 24 * 60 * 60 * 1000;

export function OverviewScreen({ onSelect }: { onSelect: (lead: Lead) => void }) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const { data: alerts = [] } = useAlerts();
  const run = useAction();

  const s = useMemo(() => {
    const now = Date.now();
    const since = (ms: number) => leads.filter((l) => now - new Date(l.created_at).getTime() <= ms);
    const closed = new Set(["won", "lost", "spam"]);
    const won = leads.filter((l) => l.status === "won");
    return {
      total: leads.length,
      active: leads.filter((l) => !closed.has(l.status)).length,
      hot: leads.filter((l) => l.temperature === "hot").length,
      cold: leads.filter((l) => l.temperature === "cold").length,
      today: since(DAY).length,
      week: since(7 * DAY).length,
      month: since(30 * DAY).length,
      won: won.length,
      wonValue: won.reduce((a, l) => a + (l.deal_value ?? 0), 0),
      pipelineValue: leads
        .filter((l) => !closed.has(l.status))
        .reduce((a, l) => a + (l.deal_value ?? 0), 0),
      conversion: leads.length ? ((won.length / leads.length) * 100).toFixed(1) : "0.0",
      unassigned: leads.filter((l) => !l.assigned_agent_id && !closed.has(l.status)).length,
      duplicates: leads.filter((l) => l.is_duplicate).length,
    };
  }, [leads]);

  const alertCount = (type: string) => alerts.filter((a) => a.alert_type === type).length;
  const recent = leads.slice(0, 8);
  const queue = leads.filter((l) => l.status === "new").slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total leads" value={num(s.total)} icon={Target} hint={`${s.month} in 30 days`} />
        <StatCard label="Active leads" value={num(s.active)} icon={Users} tone="info" hint={`${s.unassigned} unassigned`} />
        <StatCard label="Hot leads" value={num(s.hot)} icon={TrendingUp} tone="destructive" />
        <StatCard label="Cold leads" value={num(s.cold)} icon={Calendar} tone="info" />
        <StatCard label="Today / Week" value={`${s.today} / ${s.week}`} icon={Calendar} tone="warning" />
        <StatCard label="Conversion rate" value={`${s.conversion}%`} icon={BarChart3} tone="success" hint={`${s.won} won`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline value" value={inr(s.pipelineValue)} icon={Activity} tone="info" />
        <StatCard label="Won revenue" value={inr(s.wonValue)} icon={TrendingUp} tone="success" />
        <StatCard label="Duplicates flagged" value={num(s.duplicates)} icon={Copy} tone="warning" />
        <StatCard label="Active alerts" value={num(alerts.length)} icon={Bell} tone="destructive" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "New lead alerts", type: "new_lead", tone: "bg-info/10 border-info/30 text-info" },
          { label: "Idle lead alerts", type: "idle", tone: "bg-warning/10 border-warning/30 text-warning" },
          { label: "SLA breach alerts", type: "sla_breach", tone: "bg-destructive/10 border-destructive/30 text-destructive" },
          { label: "High-value alerts", type: "high_value", tone: "bg-success/10 border-success/30 text-success" },
        ].map((a) => (
          <div key={a.type} className={`flex items-center gap-3 rounded-lg border p-4 ${a.tone}`}>
            <span className="size-2.5 animate-pulse rounded-full bg-current" />
            <div>
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{alertCount(a.type)} active</p>
            </div>
          </div>
        ))}
      </div>

      <Panel
        title="New leads queue"
        description="Freshly captured leads awaiting first contact — route them to the best-fit agent instantly."
        actions={<Badge variant="outline">{queue.length} waiting</Badge>}
      >
        <div className="space-y-2">
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue is clear — every new lead has been picked up.</p>
          ) : (
            queue.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-2 p-3"
              >
                <button className="text-left" onClick={() => onSelect(lead)}>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.sub_source} • {lead.city ?? lead.country} • {relTime(lead.created_at)}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">AI {lead.ai_score}</Badge>
                  <span className="font-mono text-xs">{inr(lead.deal_value)}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => run(() => leadApi.autoAssign(lead.id), "Lead auto-routed")}
                  >
                    Auto-route
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Recent leads" description="Latest captures across every connected source.">
        <LeadTable
          leads={recent}
          agents={agents}
          isLoading={isLoading}
          onSelect={onSelect}
          columns={["source", "status", "agent", "score", "value", "created"]}
        />
      </Panel>

      <Panel title="Live alert stream" description="Automated signals raised by the scoring and SLA engines.">
        <div className="space-y-2">
          {alerts.slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-md border border-border bg-surface-2 p-3">
              <AlertTriangle
                className={`mt-0.5 size-4 ${a.severity === "high" ? "text-destructive" : a.severity === "medium" ? "text-warning" : "text-info"}`}
              />
              <div className="flex-1">
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  {a.alert_type.replace(/_/g, " ")} • {relTime(a.created_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => run(() => leadApi.acknowledgeAlert(a.id), "Alert acknowledged")}>
                Acknowledge
              </Button>
            </div>
          ))}
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">No active alerts.</p> : null}
        </div>
      </Panel>
    </div>
  );
}
