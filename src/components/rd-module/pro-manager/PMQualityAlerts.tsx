import { useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMQualityAlerts } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMBadge, PMEmpty, PMLoading, PMPanel, StatusBadge, formatDate } from "./pm-ui";

export const PMQualityAlerts = () => {
  const { data, isLoading } = usePMQualityAlerts();
  const { updateQualityAlert, run } = useProManagerActions();
  const { qualityPattern, isLoading: aiBusy } = useProManagerAI();
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const alerts = data ?? [];

  return (
    <PMPanel
      title="AI quality alerts"
      description="Patterns detected across delivery and support"
      icon={ShieldAlert}
    >
      {isLoading ? (
        <PMLoading />
      ) : alerts.length === 0 ? (
        <PMEmpty message="No quality patterns detected." />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.pattern}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.affected_entity} ({alert.entity_type}) • detected{" "}
                    {formatDate(alert.detected_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PMBadge tone="info">{alert.confidence}% confidence</PMBadge>
                  <StatusBadge value={alert.severity} />
                  {alert.acknowledged && <PMBadge tone="success">acknowledged</PMBadge>}
                </div>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">{alert.description}</p>
              <p className="mt-2 text-xs text-foreground/80">
                <span className="text-foreground">AI reasoning:</span> {alert.reasoning}
              </p>
              <p className="mt-1 text-xs text-foreground/80">
                <span className="text-foreground">Suggested action:</span> {alert.suggested_action}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={alert.acknowledged}
                  onClick={() =>
                    void run(
                      "Alert acknowledged",
                      updateQualityAlert({
                        data: { id: alert.id, code: alert.code, intent: "acknowledge" },
                      }),
                    )
                  }
                >
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void run(
                      "Alert escalated",
                      updateQualityAlert({
                        data: { id: alert.id, code: alert.code, intent: "escalate" },
                      }),
                    )
                  }
                >
                  Escalate for review
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await qualityPattern({
                      pattern: alert.pattern,
                      affected_entity: alert.affected_entity,
                      entity_type: alert.entity_type,
                      description: alert.description,
                      confidence: alert.confidence,
                      suggested_action: alert.suggested_action,
                    });
                    if (result) setExplanations((prev) => ({ ...prev, [alert.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Explain pattern
                </Button>
              </div>

              {explanations[alert.id] && <AIOutput text={explanations[alert.id]!} />}
            </div>
          ))}
        </div>
      )}
    </PMPanel>
  );
};
