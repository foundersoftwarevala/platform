import { useState } from "react";
import { CheckCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, titleCase } from "@/lib/tm/format";
import { useApprovals, useDecideApproval } from "@/lib/tm/hooks";
import { PriorityBadge, StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TaskCode } from "../shared";

export function TMApproval({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: approvals, isLoading } = useApprovals();
  const decide = useDecideApproval();
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  if (isLoading) return <TMLoading label="Loading approvals" />;
  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const decided = (approvals ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Approval" subtitle="Multi-stage sign-off with recorded remarks" actions={<Badge variant="outline">{pending.length} pending</Badge>} />

      <TMPanel title="Awaiting decision" icon={<CheckCircle className="h-4 w-4" />}>
        <div className="space-y-4">
          {pending.map((approval) => (
            <div key={approval.id} className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TaskCode code={approval.task?.code ?? "—"} />
                    {approval.task && <StatusBadge status={approval.task.status} />}
                    {approval.task && <PriorityBadge priority={approval.task.priority} />}
                  </div>
                  <p className="truncate text-sm text-foreground">{approval.task?.title ?? "Unknown task"}</p>
                  <p className="text-xs text-muted-foreground">
                    Stage {approval.position} • {titleCase(approval.stage)} • approver {approval.approver_name}
                  </p>
                </div>
                {approval.task_id && (
                  <Button size="sm" variant="outline" onClick={() => onOpenTask(approval.task_id)}>Open task</Button>
                )}
              </div>
              <Textarea
                rows={2}
                placeholder="Remarks (stored with the decision)"
                value={remarks[approval.id] ?? ""}
                onChange={(e) => setRemarks({ ...remarks, [approval.id]: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ approval, status: "approved", remarks: remarks[approval.id] ?? "" })}>Approve</Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ approval, status: "changes_requested", remarks: remarks[approval.id] ?? "" })}>Request changes</Button>
                <Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate({ approval, status: "rejected", remarks: remarks[approval.id] ?? "" })}>Reject</Button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <TMEmpty message="No approvals waiting" />}
        </div>
      </TMPanel>

      <TMPanel title="Decision history">
        <div className="space-y-2">
          {decided.map((approval) => (
            <TMRow key={approval.id}>
              <div className="min-w-0">
                <p className="text-sm text-foreground">{approval.task?.code} — {approval.task?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(approval.stage)} • {approval.approver_name} • {titleCase(approval.status)} • {formatDateTime(approval.decided_at)}
                </p>
                {approval.remarks && <p className="text-xs text-muted-foreground">“{approval.remarks}”</p>}
              </div>
            </TMRow>
          ))}
          {decided.length === 0 && <TMEmpty message="No decisions recorded yet" />}
        </div>
      </TMPanel>
    </div>
  );
}
