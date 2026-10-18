import { useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMSatisfaction } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMEmpty, PMLoading, PMPanel, PMSection, PMStat, StatusBadge } from "../pm-ui";

export const PROSatisfactionRating = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMSatisfaction();
  const { saveSatisfactionPrediction, run } = useProManagerActions();
  const { churnRisk, isLoading: aiBusy } = useProManagerAI();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((row) =>
    term ? [row.user_code, row.risk, row.feedback].join(" ").toLowerCase().includes(term) : true,
  );

  const avg = rows.length ? (rows.reduce((s, r) => s + r.csat, 0) / rows.length).toFixed(1) : "—";
  const highRisk = rows.filter((r) => r.risk === "high").length;

  return (
    <PMSection
      title="Satisfaction & rating"
      description="CSAT scores, verbatim feedback and AI churn-risk predictions per premium account."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <PMStat label="Accounts rated" value={rows.length} icon={Star} />
        <PMStat label="Average CSAT" value={avg} icon={Star} tone="success" />
        <PMStat label="High churn risk" value={highRisk} icon={Star} tone="danger" />
      </div>

      {isLoading ? (
        <PMPanel>
          <PMLoading rows={3} />
        </PMPanel>
      ) : rows.length === 0 ? (
        <PMPanel>
          <PMEmpty message="No satisfaction records match this search." />
        </PMPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <PMPanel
              key={row.id}
              title={row.user_code}
              description={`CSAT ${row.csat}/5`}
              actions={<StatusBadge value={`${row.risk} risk`} />}
            >
              <p className="text-sm text-muted-foreground">“{row.feedback}”</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-foreground">AI prediction:</span>{" "}
                {row.ai_prediction || "Not generated yet"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await churnRisk(row.user_code, row.csat, row.risk, row.feedback);
                    if (result) setDrafts((prev) => ({ ...prev, [row.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Predict churn risk
                </Button>
                {drafts[row.id] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void run(
                        "AI prediction saved",
                        saveSatisfactionPrediction({
                          data: {
                            id: row.id,
                            user_code: row.user_code,
                            prediction: drafts[row.id]!.slice(0, 4000),
                          },
                        }),
                      )
                    }
                  >
                    Save prediction
                  </Button>
                )}
              </div>
              {drafts[row.id] && <AIOutput text={drafts[row.id]!} />}
            </PMPanel>
          ))}
        </div>
      )}
    </PMSection>
  );
};
