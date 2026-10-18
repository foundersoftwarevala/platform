import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Progress } from "@/components/rd-module/ui/progress";
import { usePMUsage } from "@/hooks/rd-module/useProManagerData";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMBadge, PMEmpty, PMLoading, PMPanel, PMSection } from "../pm-ui";

const Meter = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}%</span>
    </div>
    <Progress value={value} className="mt-1.5 h-2" />
  </div>
);

export const PROUsageLimits = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMUsage();
  const { usageAdvice, isLoading: aiBusy } = useProManagerAI();
  const [advice, setAdvice] = useState<Record<string, string>>({});

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((row) =>
    term ? row.user_code.toLowerCase().includes(term) : true,
  );

  return (
    <PMSection
      title="Usage & limits"
      description="API, storage and AI consumption against fair-usage thresholds."
    >
      {isLoading ? (
        <PMPanel>
          <PMLoading rows={3} />
        </PMPanel>
      ) : rows.length === 0 ? (
        <PMPanel>
          <PMEmpty message="No usage records match this search." />
        </PMPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <PMPanel
              key={row.id}
              title={row.user_code}
              actions={
                row.fair_usage_alert ? (
                  <PMBadge tone="warning">fair usage alert</PMBadge>
                ) : (
                  <PMBadge tone="success">within limits</PMBadge>
                )
              }
            >
              <div className="space-y-3">
                <Meter label="API calls" value={row.api_pct} />
                <Meter label="Storage" value={row.storage_pct} />
                <Meter label="AI calls" value={row.ai_calls_pct} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-3"
                disabled={aiBusy}
                onClick={async () => {
                  const result = await usageAdvice({
                    user_code: row.user_code,
                    api_pct: row.api_pct,
                    storage_pct: row.storage_pct,
                    ai_calls_pct: row.ai_calls_pct,
                    fair_usage_alert: row.fair_usage_alert,
                  });
                  if (result) setAdvice((prev) => ({ ...prev, [row.id]: result }));
                }}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI usage advice
              </Button>
              {advice[row.id] && <AIOutput text={advice[row.id]!} />}
            </PMPanel>
          ))}
        </div>
      )}
    </PMSection>
  );
};
