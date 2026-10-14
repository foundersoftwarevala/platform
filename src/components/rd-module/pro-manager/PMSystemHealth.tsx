import { Activity, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMHealthMetrics } from "@/hooks/rd-module/useProManagerData";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMEmpty, PMLoading, PMPanel, StatusBadge } from "./pm-ui";

export const PMSystemHealth = () => {
  const { data, isLoading } = usePMHealthMetrics();
  const { healthAnalysis, isLoading: aiBusy } = useProManagerAI();
  const [analysis, setAnalysis] = useState<string | null>(null);

  const metrics = data ?? [];

  return (
    <PMPanel
      title="System health"
      description="Live operational signals across fulfilment, SLA and quality"
      icon={Activity}
      actions={
        <Button
          size="sm"
          variant="outline"
          disabled={aiBusy || metrics.length === 0}
          onClick={async () => {
            const result = await healthAnalysis(
              metrics.map((m) => `${m.name}: ${m.value} (${m.status}, ${m.trend})`).join("; "),
            );
            if (result) setAnalysis(result);
          }}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {aiBusy ? "Analysing…" : "AI analysis"}
        </Button>
      }
    >
      {isLoading ? (
        <PMLoading />
      ) : metrics.length === 0 ? (
        <PMEmpty message="No health metrics recorded yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{metric.name}</p>
                <StatusBadge value={metric.status} />
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-foreground">
                {metric.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {metric.description} • trend {metric.trend}
              </p>
            </div>
          ))}
        </div>
      )}
      {analysis && <AIOutput text={analysis} />}
    </PMPanel>
  );
};
