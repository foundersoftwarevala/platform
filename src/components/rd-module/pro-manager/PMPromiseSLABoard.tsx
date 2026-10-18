import { useState } from "react";
import { Timer, Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { usePMPromises } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMEmpty, PMLoading, PMPanel, StatusBadge, formatDate } from "./pm-ui";

export const PMPromiseSLABoard = () => {
  const { data, isLoading } = usePMPromises();
  const { updatePromise, run } = useProManagerActions();
  const { slaAdvice, isLoading: aiBusy } = useProManagerAI();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [advice, setAdvice] = useState<Record<string, string>>({});

  const promises = data ?? [];

  return (
    <PMPanel
      title="Promise & SLA board"
      description="Delivery promises the Pro Manager governs"
      icon={Timer}
    >
      {isLoading ? (
        <PMLoading />
      ) : promises.length === 0 ? (
        <PMEmpty message="No active promises." />
      ) : (
        <div className="space-y-3">
          {promises.map((promise) => (
            <div key={promise.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {promise.code} — {promise.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Task {promise.task_code} • owner {promise.owner} • dev {promise.developer_code}{" "}
                    • due {formatDate(promise.deadline)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={promise.priority} />
                  <StatusBadge value={promise.status} />
                </div>
              </div>

              <Textarea
                value={notes[promise.id] ?? ""}
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [promise.id]: event.target.value }))
                }
                placeholder="Decision note (required for escalation and correction requests)"
                className="mt-3 min-h-16"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void run(
                      "Promise marked fulfilled",
                      updatePromise({
                        data: {
                          id: promise.id,
                          code: promise.code,
                          intent: "fulfil",
                          status: "fulfilled",
                          note: notes[promise.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Mark fulfilled
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "Extension recommended",
                      updatePromise({
                        data: {
                          id: promise.id,
                          code: promise.code,
                          intent: "extend",
                          extendHours: 24,
                          note: notes[promise.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Extend 24h
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "Correction requested",
                      updatePromise({
                        data: {
                          id: promise.id,
                          code: promise.code,
                          intent: "correction",
                          note: notes[promise.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Request correction
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void run(
                      "Promise escalated",
                      updatePromise({
                        data: {
                          id: promise.id,
                          code: promise.code,
                          intent: "escalate",
                          status: "near_breach",
                          note: notes[promise.id] ?? "",
                        },
                      }),
                    )
                  }
                >
                  Escalate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await slaAdvice({
                      code: promise.code,
                      action: promise.action,
                      task_code: promise.task_code,
                      owner: promise.owner,
                      deadline: promise.deadline,
                      status: promise.status,
                      priority: promise.priority,
                    });
                    if (result) setAdvice((prev) => ({ ...prev, [promise.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI advice
                </Button>
              </div>

              {advice[promise.id] && <AIOutput text={advice[promise.id]!} />}
            </div>
          ))}
        </div>
      )}
    </PMPanel>
  );
};
