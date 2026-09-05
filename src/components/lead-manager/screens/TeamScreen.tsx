import { useMemo } from "react";
import { Activity, AlertCircle, BarChart3, Layers, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgents, useEscalations, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { Panel, StatCard, num } from "../shared";
import { useAction } from "./common";

export function TeamScreen() {
  const { data: agents = [] } = useAgents();
  const { data: leads = [] } = useLeads();
  const { data: escalations = [] } = useEscalations();
  const run = useAction();
  const load = useMemo(() => {
    const result = new Map<string, number>();
    for (const lead of leads) if (lead.assigned_agent_id && !["won", "lost", "spam"].includes(lead.status)) result.set(lead.assigned_agent_id, (result.get(lead.assigned_agent_id) ?? 0) + 1);
    return result;
  }, [leads]);
  const avg = agents.length ? Math.round(agents.reduce((sum, agent) => sum + Number(agent.conversion_rate), 0) / agents.length) : 0;

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total agents" value={num(agents.length)} icon={Users} />
      <StatCard label="Online now" value={num(agents.filter((a) => a.status === "online").length)} icon={Activity} tone="success" />
      <StatCard label="Avg performance" value={`${avg}%`} icon={BarChart3} tone="info" />
      <StatCard label="Escalations" value={num(escalations.filter((e) => !e.is_resolved).length)} icon={AlertCircle} tone="destructive" />
    </div>
    <Panel title="Sales team list" description="Availability, capacity, response time and conversion performance from the live team registry.">
      <div className="grid gap-3 xl:grid-cols-2">
        {agents.map((agent) => {
          const current = load.get(agent.id) ?? 0;
          const percent = Math.min(100, Math.round((current / agent.capacity) * 100));
          return <div key={agent.id} className="rounded-md border border-border bg-surface-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-medium">{agent.name}</p><p className="text-xs text-muted-foreground">{agent.role} • {agent.team} • {agent.email}</p></div>
              <Select value={agent.status} onValueChange={(value) => run(() => leadApi.setAgentStatus(agent.id, value as "online" | "busy" | "offline"), `${agent.name} is now ${value}`)}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="busy">Busy</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>{current}/{agent.capacity} active leads</span><span>{Number(agent.conversion_rate)}% conversion • {agent.avg_response_minutes}m response</span></div>
            <Progress value={percent} className="mt-2 h-2" />
            <div className="mt-3 flex gap-2"><Badge variant="outline">Export {agent.can_export ? "allowed" : "locked"}</Badge><Badge variant="outline">Contact {agent.can_unmask ? "visible" : "masked"}</Badge></div>
          </div>;
        })}
      </div>
    </Panel>
    <Panel title="Lead load per agent" description="Capacity utilization used by automatic load balancing and failover.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{agents.map((agent) => <div key={agent.id} className="stat-tile p-3"><Layers className="size-4 text-primary"/><p className="mt-2 text-sm font-medium">{agent.name}</p><p className="text-xs text-muted-foreground">{load.get(agent.id) ?? 0} active • capacity {agent.capacity}</p></div>)}</div>
    </Panel>
  </div>;
}