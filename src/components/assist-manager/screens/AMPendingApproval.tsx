/**
 * PENDING APPROVAL
 * Sessions awaiting boss / manager authorization.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clock, Timer, User, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useApprovals, useDecideApproval } from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  StatCard,
  StatusPill,
  countdown,
  timeAgo,
  titleCase,
} from "../am-ui";

const WINDOW_MINUTES = 15;

export function AMPendingApproval() {
  const { data: approvals = [], isLoading } = useApprovals();
  const decide = useDecideApproval();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const pending = approvals.filter((a) => a.status === "pending");
  const today = (iso: string | null) =>
    Boolean(iso) && new Date(iso as string).toDateString() === new Date().toDateString();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Pending Approval"
          subtitle="Sessions awaiting authorization"
          actions={
            <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              <Clock className="h-3.5 w-3.5" />
              {pending.length} Waiting
            </span>
          }
        />

        {isLoading ? (
          <LoadingBlock />
        ) : pending.length === 0 ? (
          <EmptyState
            title="No approvals waiting"
            description="New assist requests appear here for authorization."
          />
        ) : (
          <div className="space-y-4">
            {pending.map((approval) => {
              const minutesLeft = Math.max(
                0,
                (new Date(approval.expires_at).getTime() - Date.now()) / 60000,
              );
              const urgent = minutesLeft <= 5;
              return (
                <Card
                  key={approval.id}
                  className={cn("border-l-4", urgent ? "border-l-destructive" : "border-l-warning")}
                >
                  <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CodeChip>{approval.session?.session_code ?? approval.approval_code}</CodeChip>
                        <CodeChip>{titleCase(approval.assist_type)}</CodeChip>
                        <CodeChip>{approval.scope}</CodeChip>
                        <StatusPill status={approval.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div>
                          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                            <User className="h-3 w-3" /> Requester
                          </p>
                          <p className="code-chip mt-1">{approval.agent?.agent_code ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Target
                          </p>
                          <p className="code-chip mt-1">{approval.end_user?.user_code ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Awaiting
                          </p>
                          <p className="mt-1">{approval.awaiting_role}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Submitted
                          </p>
                          <p className="mt-1">{timeAgo(approval.submitted_at)}</p>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Timer className="h-3 w-3" />
                            Expires in
                          </span>
                          <span
                            className={cn(
                              "code-chip font-medium",
                              urgent ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {countdown(approval.expires_at)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, (minutesLeft / WINDOW_MINUTES) * 100)}
                          className="h-1.5"
                        />
                      </div>

                      {urgent ? (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Request will expire soon
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: approval.id,
                            sessionId: approval.session?.id,
                            decision: "approved",
                          })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            id: approval.id,
                            sessionId: approval.session?.id,
                            decision: "rejected",
                            note: "Rejected by authorizer",
                          })
                        }
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Pending" value={pending.length} icon={Clock} tone="warning" />
          <StatCard
            label="Approved today"
            value={approvals.filter((a) => a.status === "approved" && today(a.decided_at)).length}
            icon={Check}
            tone="success"
          />
          <StatCard
            label="Rejected today"
            value={approvals.filter((a) => a.status === "rejected" && today(a.decided_at)).length}
            icon={X}
            tone="danger"
          />
        </div>
      </div>
    </ScrollArea>
  );
}

export default AMPendingApproval;
