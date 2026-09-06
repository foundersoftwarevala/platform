import { useMemo } from "react";
import { Clock, DollarSign, TrendingUp, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, formatMinutes, titleCase } from "@/lib/tm/format";
import { useMembers, useTasks } from "@/lib/tm/hooks";
import { TM_ACTIVE_STATUSES } from "@/lib/tm/types";
import { StatusBadge, TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow, TMStat, TaskCode } from "../shared";

export function TMWallet({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: members } = useMembers();

  const wallet = useMemo(() => {
    const billable = (tasks ?? []).filter((t) => t.billable);
    const settled = billable.filter((t) => t.status === "completed");
    const pending = billable.filter((t) => TM_ACTIVE_STATUSES.includes(t.status));
    const cancelled = billable.filter((t) => t.status === "cancelled");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = settled.filter((t) => t.completed_at && new Date(t.completed_at) >= monthStart);
    const sum = (list: typeof billable) => list.reduce((acc, t) => acc + Number(t.cost), 0);
    return {
      billed: sum(settled),
      pending: sum(pending),
      thisMonth: sum(thisMonth),
      lost: sum(cancelled),
      settled: settled.sort((a, b) => new Date(b.completed_at ?? b.updated_at).getTime() - new Date(a.completed_at ?? a.updated_at).getTime()),
      pendingList: pending.sort((a, b) => Number(b.cost) - Number(a.cost)),
      nonBillable: (tasks ?? []).filter((t) => !t.billable).length,
      total: sum(billable),
    };
  }, [tasks]);

  const perMember = useMemo(
    () =>
      (members ?? [])
        .map((member) => {
          const owned = (tasks ?? []).filter((t) => t.assigned_to === member.id && t.billable);
          const earned = owned.filter((t) => t.status === "completed").reduce((acc, t) => acc + Number(t.cost), 0);
          return { member, earned, count: owned.length, minutes: owned.reduce((acc, t) => acc + t.actual_minutes, 0) };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.earned - a.earned),
    [members, tasks],
  );

  if (isLoading) return <TMLoading label="Loading task wallet" />;

  return (
    <div className="space-y-6">
      <TMPageHeader title="Task Wallet" subtitle="Billable value, settled revenue and pending recovery from live task costs" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TMStat label="Settled (delivered)" value={formatCurrency(wallet.billed)} icon={<Wallet />} tone="success" />
        <TMStat label="Pending in flight" value={formatCurrency(wallet.pending)} icon={<Clock />} tone="warning" />
        <TMStat label="This month" value={formatCurrency(wallet.thisMonth)} icon={<TrendingUp />} tone="info" />
        <TMStat label="Lost to cancellation" value={formatCurrency(wallet.lost)} icon={<DollarSign />} tone="danger" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TMPanel title="Settled billable tasks" actions={<Badge variant="outline">{wallet.settled.length}</Badge>}>
          <div className="space-y-3">
            {wallet.settled.slice(0, 10).map((task) => (
              <TMRow key={task.id}>
                <div className="min-w-0">
                  <TaskCode code={task.code} />
                  <p className="truncate text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.client_name ?? "Internal"} • {formatDate(task.completed_at)} • {formatMinutes(task.actual_minutes)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm text-success">{formatCurrency(Number(task.cost))}</span>
                  <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>Open</Button>
                </div>
              </TMRow>
            ))}
            {wallet.settled.length === 0 && <TMEmpty message="No settled billable tasks yet" />}
          </div>
        </TMPanel>

        <TMPanel title="Pending billable pipeline" actions={<Badge variant="outline">{wallet.pendingList.length}</Badge>}>
          <div className="space-y-3">
            {wallet.pendingList.slice(0, 10).map((task) => (
              <TMRow key={task.id}>
                <div className="min-w-0">
                  <TaskCode code={task.code} />
                  <p className="truncate text-sm text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.client_name ?? "Internal"} • due {formatDate(task.deadline ?? task.promised_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  <span className="font-display text-sm text-warning">{formatCurrency(Number(task.cost))}</span>
                  <Button size="sm" variant="ghost" onClick={() => onOpenTask(task.id)}>Open</Button>
                </div>
              </TMRow>
            ))}
            {wallet.pendingList.length === 0 && <TMEmpty message="Nothing pending" />}
          </div>
        </TMPanel>
      </div>

      <TMPanel title="Billable value by owner" actions={<Badge variant="outline">{wallet.nonBillable} non-billable tasks</Badge>}>
        <div className="space-y-3">
          {perMember.map(({ member, earned, count, minutes }) => (
            <div key={member.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {member.full_name} <span className="text-xs text-muted-foreground">({titleCase(member.role)})</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(earned)} settled • {count} billable • {formatMinutes(minutes)}
                </span>
              </div>
              <Progress value={wallet.total ? (earned / wallet.total) * 100 : 0} className="h-2" />
            </div>
          ))}
          {perMember.length === 0 && <TMEmpty message="No billable ownership yet" />}
        </div>
      </TMPanel>
    </div>
  );
}
