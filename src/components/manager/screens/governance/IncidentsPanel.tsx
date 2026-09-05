import { useMemo } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge, when } from "@/components/manager/primitives";

export function IncidentsPanel({
  incidents,
  alerts,
  services,
}: {
  incidents: Row[];
  alerts: Row[];
  services: Row[];
}) {
  const updateIncident = useUpdateRecord("Incident resolved");
  const updateAlert = useUpdateRecord("Alert resolved");

  const serviceById = useMemo(() => new Map(services.map((s) => [s["id"], s])), [services]);

  const openIncidents = incidents.filter((i) => i["status"] !== "resolved");
  const openAlerts = alerts.filter((a) => a["status"] !== "resolved");

  const resolveIncident = (row: Row) => {
    updateIncident.mutate({
      table: "incidents",
      id: row["id"] as string,
      values: { status: "resolved", resolved_at: new Date().toISOString() },
    });
  };

  const resolveAlert = (row: Row) => {
    updateAlert.mutate({
      table: "security_alerts",
      id: row["id"] as string,
      values: { status: "resolved", resolved_at: new Date().toISOString() },
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Active Incidents" value={openIncidents.length} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
        <StatCard label="Total Incidents" value={incidents.length} icon={<AlertTriangle className="h-4 w-4" />} tone="violet" />
        <StatCard label="Active Alerts" value={openAlerts.length} icon={<ShieldAlert className="h-4 w-4" />} tone="red" />
        <StatCard label="Total Alerts" value={alerts.length} icon={<ShieldAlert className="h-4 w-4" />} tone="cyan" />
      </div>

      <GlassCard title="Incidents" icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
        {incidents.length === 0 ? (
          <EmptyState message="No incidents recorded" />
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => {
              const svc = serviceById.get(incident["service_id"]) as Row | undefined;
              return (
                <div key={incident["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{String(incident["title"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {svc ? String(svc["name"]) : "Unknown service"} · started {when(incident["started_at"] as string)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={String(incident["severity"])} />
                      <StatusBadge value={String(incident["status"])} />
                      {incident["status"] !== "resolved" ? (
                        <Button size="sm" variant="outline" onClick={() => resolveIncident(incident)}>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Resolve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {incident["root_cause"] ? (
                    <p className="mt-1 text-xs text-muted-foreground">Root cause: {String(incident["root_cause"])}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Security Alerts" icon={<ShieldAlert className="h-4 w-4 text-primary" />}>
        {alerts.length === 0 ? (
          <EmptyState message="No security alerts recorded" />
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{String(alert["title"])}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(alert["source"])} · detected {when(alert["detected_at"] as string)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{String(alert["category"])}</Badge>
                    <StatusBadge value={String(alert["severity"])} />
                    <StatusBadge value={String(alert["status"])} />
                    {alert["status"] !== "resolved" ? (
                      <Button size="sm" variant="outline" onClick={() => resolveAlert(alert)}>
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Resolve
                      </Button>
                    ) : null}
                  </div>
                </div>
                {alert["description"] ? (
                  <p className="mt-1 text-xs text-muted-foreground">{String(alert["description"])}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
