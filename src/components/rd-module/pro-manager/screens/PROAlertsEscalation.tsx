import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMAlerts } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, PMSection, PMStat, StatusBadge, formatDate } from "../pm-ui";
import { PMEscalationsQueue } from "../PMEscalationsQueue";

export const PROAlertsEscalation = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMAlerts();
  const { acknowledgeAlert, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const alerts = (data ?? []).filter((row) =>
    term
      ? [row.code, row.type, row.message, row.severity].join(" ").toLowerCase().includes(term)
      : true,
  );
  const open = alerts.filter((a) => !a.acknowledged).length;
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <PMSection
      title="Alerts & escalation"
      description="Operational alerts plus the live escalation queue routed to human review."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <PMStat label="Alerts" value={alerts.length} icon={AlertTriangle} />
        <PMStat label="Unacknowledged" value={open} icon={AlertTriangle} tone="warning" />
        <PMStat label="Critical" value={critical} icon={AlertTriangle} tone="danger" />
      </div>

      <PMPanel title="Recent alerts">
        {isLoading ? (
          <PMLoading rows={4} />
        ) : alerts.length === 0 ? (
          <PMEmpty message="No alerts match this search." />
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.code} • {alert.type} • {formatDate(alert.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={alert.severity} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={alert.acknowledged}
                    onClick={() =>
                      void run(
                        "Alert acknowledged",
                        acknowledgeAlert({ data: { id: alert.id, code: alert.code } }),
                      )
                    }
                  >
                    {alert.acknowledged ? "Acknowledged" : "Acknowledge"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PMPanel>

      <PMEscalationsQueue />
    </PMSection>
  );
};
