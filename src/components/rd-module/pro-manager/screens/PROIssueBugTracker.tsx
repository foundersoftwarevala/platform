import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMIssues } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import {
  AIOutput,
  PMBadge,
  PMEmpty,
  PMLoading,
  PMPanel,
  PMSection,
  StatusBadge,
  formatDate,
} from "../pm-ui";

export const PROIssueBugTracker = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMIssues();
  const { updateIssue, run } = useProManagerActions();
  const { triageIssue, isLoading: aiBusy } = useProManagerAI();
  const [triage, setTriage] = useState<Record<string, string>>({});

  const term = search.trim().toLowerCase();
  const issues = (data ?? []).filter((row) =>
    term
      ? [row.code, row.build, row.summary, row.status].join(" ").toLowerCase().includes(term)
      : true,
  );

  return (
    <PMSection
      title="Issue & bug tracker"
      description="Product defects with AI auto-fix attempts, developer review routing and resolution."
    >
      {isLoading ? (
        <PMPanel>
          <PMLoading rows={4} />
        </PMPanel>
      ) : issues.length === 0 ? (
        <PMPanel>
          <PMEmpty message="No issues match this search." />
        </PMPanel>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <PMPanel key={issue.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {issue.code} — {issue.summary}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Build {issue.build} • {issue.ai_attempts} AI attempts • last attempt{" "}
                    {formatDate(issue.last_attempt_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PMBadge tone="muted">{issue.build}</PMBadge>
                  <StatusBadge value={issue.status} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "AI fix retry registered",
                      updateIssue({
                        data: {
                          id: issue.id,
                          code: issue.code,
                          status: "ai_fixing",
                          registerAiAttempt: true,
                          currentAttempts: issue.ai_attempts,
                        },
                      }),
                    )
                  }
                >
                  Retry AI fix
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void run(
                      "Sent to developer review",
                      updateIssue({
                        data: {
                          id: issue.id,
                          code: issue.code,
                          status: "dev_review",
                          registerAiAttempt: false,
                          currentAttempts: issue.ai_attempts,
                        },
                      }),
                    )
                  }
                >
                  Send to dev team
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    void run(
                      "Issue resolved",
                      updateIssue({
                        data: {
                          id: issue.id,
                          code: issue.code,
                          status: "resolved",
                          registerAiAttempt: false,
                          currentAttempts: issue.ai_attempts,
                        },
                      }),
                    )
                  }
                >
                  Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={aiBusy}
                  onClick={async () => {
                    const result = await triageIssue(
                      issue.code,
                      issue.build,
                      issue.summary,
                      issue.status,
                      issue.ai_attempts,
                    );
                    if (result) setTriage((prev) => ({ ...prev, [issue.id]: result }));
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI triage
                </Button>
              </div>

              {triage[issue.id] && <AIOutput text={triage[issue.id]!} />}
            </PMPanel>
          ))}
        </div>
      )}
    </PMSection>
  );
};
