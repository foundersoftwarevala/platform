import React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, Clock, ArrowUpRight, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeliveryOverview, useEscalateTask } from '@/hooks/useDevManagerData';
import { InfoHint } from '@/components/dev-manager/ui-helpers';
import type { BlockedTaskDTO } from '@/lib/dev-manager.types';

export default function DevManagerBlockedTasks() {
  const { data, isLoading, error } = useDeliveryOverview();
  const escalate = useEscalateTask();
  const blockedTasks = data?.blocked ?? [];

  const handleEscalate = (task: BlockedTaskDTO) => {
    escalate.mutate({
      taskId: task.taskId,
      reason: `Manual escalation: ${task.code} blocked ${task.blockedHours}h — ${task.blockedReason}`,
    });
  };

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono tracking-wider text-muted-foreground flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            BLOCKED TASKS
            <InfoHint text="A blocked task auto-escalates to the area manager once it passes its escalation threshold." />
          </CardTitle>
          <Badge variant="outline" className="font-mono text-red-400 border-red-500/30">
            {blockedTasks.length} Blocked
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground font-mono">Loading blocked tasks…</p>}
        {error && (
          <p className="text-sm text-red-400 font-mono">
            {error instanceof Error ? error.message : 'Failed to load blocked tasks'}
          </p>
        )}
        {blockedTasks.map((task, idx) => {
          const isAutoEscalated = task.escalated || task.blockedHours >= task.autoEscalateThreshold;

          return (
            <motion.div
              key={task.taskId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-4 rounded-lg border ${
                isAutoEscalated
                  ? 'border-red-500/50 bg-red-500/10'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs">{task.code}</span>
                    {isAutoEscalated && (
                      <Badge className="text-xs bg-red-500/20 text-red-400">
                        ESCALATED
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium">{task.title}</h4>
                  <p className="text-sm text-muted-foreground font-mono">{task.assignee}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{task.blockedHours}h blocked</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    Threshold: {task.autoEscalateThreshold}h
                  </p>
                  <p
                    className={`text-xs mt-0.5 tabular-nums ${
                      isAutoEscalated ? 'text-red-400' : 'text-muted-foreground'
                    }`}
                  >
                    {isAutoEscalated
                      ? 'Auto-escalation triggered'
                      : `Auto-escalates in ${Math.max(
                          0,
                          task.autoEscalateThreshold - task.blockedHours,
                        )}h`}
                  </p>
                </div>
              </div>

              {/* Blocked Reason */}
              <div className="p-3 bg-muted/40 rounded border border-border mb-3">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">BLOCKED REASON</p>
                    <p className="text-sm">{task.blockedReason}</p>
                  </div>
                </div>
              </div>

              {!task.escalated && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  disabled={escalate.isPending}
                  onClick={() => handleEscalate(task)}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Manual Escalate
                </Button>
              )}
            </motion.div>
          );
        })}

        {!isLoading && !error && blockedTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mx-auto mb-3 w-fit rounded-full bg-emerald-500/10 p-4">
              <AlertOctagon className="h-10 w-10 text-emerald-400" />
            </div>
            <p className="text-base font-medium text-foreground">No blocked tasks</p>
            <p className="mt-1 text-sm">Nothing is waiting on a dependency right now.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
