import { useMemo } from "react";
import { AlertTriangle, Bell, Clock, Copy, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAlerts, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead } from "@/lib/lead-manager/types";
import { Panel, StatCard, relTime } from "../shared";
import { useAction } from "./common";

const TYPES = [{ key: "new_lead", label: "New Lead Alert", icon: Bell }, { key: "idle", label: "Idle Lead Alert", icon: Clock }, { key: "sla_breach", label: "SLA Breach Alert", icon: AlertTriangle }, { key: "duplicate", label: "Duplicate Lead Alert", icon: Copy }, { key: "high_value", label: "High-Value Lead Alert", icon: Target }];
export function AlertsScreen({ section, onSelect }: { section: string; onSelect: (lead: Lead) => void }) {
  const { data: alerts = [] } = useAlerts();
  const { data: leads = [] } = useLeads();
  const run = useAction();
  const selectedType = ({ new_lead_alert: "new_lead", idle_alert: "idle", sla_breach: "sla_breach", duplicate_alert: "duplicate", high_value_alert: "high_value" } as Record<string, string>)[section];
  const rows = useMemo(() => selectedType ? alerts.filter((a) => a.alert_type === selectedType) : alerts, [alerts, selectedType]);
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{TYPES.map((type) => <StatCard key={type.key} label={type.label} value={String(alerts.filter((a) => a.alert_type === type.key).length)} icon={type.icon} tone={type.key === "sla_breach" ? "destructive" : type.key === "high_value" ? "success" : "info"} />)}</div>
    <Panel title={`Active alerts — ${rows.length}`} description="Live signals raised by capture, duplicate, value and SLA monitors.">
      <div className="space-y-2">{rows.map((alert) => {
        const lead = alert.lead_id ? leadMap.get(alert.lead_id) : undefined;
        return <div key={alert.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
          <AlertTriangle className={`size-4 ${alert.severity === "high" ? "text-destructive" : "text-warning"}`} />
          <button className="min-w-48 flex-1 text-left" disabled={!lead} onClick={() => lead && onSelect(lead)}><p className="text-sm font-medium">{alert.message}</p><p className="text-xs text-muted-foreground">{alert.alert_type.replace(/_/g, " ")} • {lead?.name ?? "System"} • {relTime(alert.created_at)}</p></button>
          <Badge variant="outline" className="capitalize">{alert.severity}</Badge>
          <Button size="sm" variant="secondary" onClick={() => run(() => leadApi.acknowledgeAlert(alert.id), "Alert acknowledged")}>Acknowledge</Button>
        </div>;
      })}{rows.length === 0 ? <p className="text-sm text-muted-foreground">No active alerts in this category.</p> : null}</div>
    </Panel>
  </div>;
}