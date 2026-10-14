import { useState } from "react";
import { Gavel, Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { usePMDecisions } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMBadge, PMEmpty, PMLoading, PMPanel, StatusBadge, formatDate } from "./pm-ui";

export const PMDecisionsPending = () => {
  const { data, isLoading } = usePMDecisions();
  const { decideRequest, run } = useProManagerActions();
  const { decisionAdvice, isLoading: aiBusy } = useProManagerAI();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [advice, setAdvice] = useState<Record<string, string>>({});

  const decisions = data ?? [];

  return (
    <PMPanel
      title="Pending decisions"
      description="Financial requests can only be recommended and forwarded, never approved here"
      icon={Gavel}
    >
      {isLoading ? (
        <PMLoading />
      ) : decisions.length === 0 ? (
        <PMEmpty message="No decisions awaiting review." />
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <div key={decision.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {decision.code} — {decision.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {decision.type} • requested by {decision.requested_by} •{" "}
                    {formatDate(decision.requested_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {decision.is_financial && (
                    <PMBadge tone="danger">financial — recommend only</PMBadge>
                  )}
                  {decision.amount != null && (
                    <PMBadge tone="info">₹{decision.amount.toLocaleString()}</PMBadge>
                  )}
                  <StatusBadge value={decision.priority} />
                  <StatusBadge value={decision.status} />
                </div>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">{decision.description}</p>
              {decision.decision_note && (
                <p className="mt-2 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                  Recorded note: {decision.decision_note}
                </p>
              )}

              <Textarea
                value={notes[decision.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [decision.id]: event.target.value }))
                }
                placeholder="Written reason (mandatory for rejection and forwarding)"
                className="mt-3 min-h-16"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void run(
                      decision.is_financial
                        ? "Financial recommendation recorded"
                        : "Decision approved",
                      decideRequest({
                        data: {
                          id: decision.id,
                          code: decision.code,
                          intent: "approve",
                          isFinancial: decision.is_financial,
                          note: notes[decision.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  {decision.is_financial ? "Recommend" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void run(
                      "Decision rejected",
                      decideRequest({
                        data: {
                          id: decision.id,
                          code: decision.code,
                          intent: "reject",
                          isFinancial: decision.is_financial,
                          note: notes[decision.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void run(
                      "Decision forwarded",
                      decideRequest({
                        data: {
                          id: decision.id,
                          code: decision.code,
                          intent: "forward",
                          isFinancial: decision.is_financial,
                          note: notes[decision.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Forward
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await decisionAdvice({
                      code: decision.code,
                      type: decision.type,
                      priority: decision.priority,
                      is_financial: decision.is_financial,
                      subject: decision.subject,
                      description: decision.description,
                      amount: decision.amount,
                    });
                    if (result) setAdvice((prev) => ({ ...prev, [decision.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI recommendation
                </Button>
              </div>

              {advice[decision.id] && <AIOutput text={advice[decision.id]!} />}
            </div>
          ))}
        </div>
      )}
    </PMPanel>
  );
};
