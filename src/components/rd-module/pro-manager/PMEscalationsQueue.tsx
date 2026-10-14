import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { usePMEscalations } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMEmpty, PMLoading, PMPanel, StatusBadge, formatDate } from "./pm-ui";

export const PMEscalationsQueue = () => {
  const { data, isLoading } = usePMEscalations();
  const { resolveEscalation, run } = useProManagerActions();
  const { escalationSummary, isLoading: aiBusy } = useProManagerAI();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  const escalations = data ?? [];

  return (
    <PMPanel
      title="Escalations queue"
      description="Every resolution requires a written decision note"
      icon={ArrowUpRight}
    >
      {isLoading ? (
        <PMLoading />
      ) : escalations.length === 0 ? (
        <PMEmpty message="No escalations in the queue." />
      ) : (
        <div className="space-y-3">
          {escalations.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.code} — {item.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.source.replace(/_/g, " ")} • {item.source_id} • raised by{" "}
                    {item.created_by} • {formatDate(item.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={item.priority} />
                  <StatusBadge value={item.status} />
                </div>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>

              {item.evidence.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {item.evidence.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              )}

              {item.decision_note && (
                <p className="mt-2 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                  Decision note: {item.decision_note}
                </p>
              )}

              <Textarea
                value={notes[item.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))
                }
                placeholder="Mandatory decision note…"
                className="mt-3 min-h-16"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void run(
                      "Escalation resolved",
                      resolveEscalation({
                        data: {
                          id: item.id,
                          code: item.code,
                          intent: "resolve",
                          note: notes[item.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "Escalation moved to review",
                      resolveEscalation({
                        data: {
                          id: item.id,
                          code: item.code,
                          intent: "review",
                          note: notes[item.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Mark in review
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void run(
                      "Escalation forwarded",
                      resolveEscalation({
                        data: {
                          id: item.id,
                          code: item.code,
                          intent: "forward",
                          note: notes[item.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Forward upward
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await escalationSummary(
                      item.code,
                      item.source,
                      item.priority,
                      item.subject,
                      item.description,
                    );
                    if (result) setSummaries((prev) => ({ ...prev, [item.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI summary
                </Button>
              </div>

              {summaries[item.id] && <AIOutput text={summaries[item.id]!} />}
            </div>
          ))}
        </div>
      )}
    </PMPanel>
  );
};
