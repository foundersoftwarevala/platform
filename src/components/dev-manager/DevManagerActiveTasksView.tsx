import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, User, ArrowRight, AlertTriangle, RefreshCw, Download, Search, Loader2 } from 'lucide-react';
import { InfoHint } from '@/components/dev-manager/ui-helpers';
import { Input } from '@/components/ui/input';
import { downloadCsv } from '@/lib/export-csv';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDeliveryOverview, useReassignTask } from '@/hooks/useDevManagerData';
import type { TaskDTO } from '@/lib/dev-manager.types';

const getPriorityColor = (priority: TaskDTO['priority']) => {
  switch (priority) {
    case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'medium': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-muted/40 text-muted-foreground border-border';
  }
};

const getStatusColor = (status: TaskDTO['status']) => {
  switch (status) {
    case 'in_progress': return 'bg-blue-500';
    case 'blocked': return 'bg-red-500';
    case 'review': return 'bg-purple-500';
    default: return 'bg-muted-foreground';
  }
};

export default function DevManagerActiveTasksView() {
  const { toast } = useToast();
  const { data, isLoading, error } = useDeliveryOverview();
  const reassign = useReassignTask();
  const [reassignDialog, setReassignDialog] = useState<TaskDTO | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [errors, setErrors] = useState<{ assignee?: string | undefined; reason?: string | undefined }>({});

  const tasks = data?.tasks ?? [];
  const developers = data?.developers ?? [];

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesTerm =
        !term ||
        task.title.toLowerCase().includes(term) ||
        task.code.toLowerCase().includes(term) ||
        task.assignedTo.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesTerm && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const assignableDevelopers = useMemo(() => {
    const order: Record<string, number> = { available: 0, busy: 1, overloaded: 2 };
    return developers
      .filter((d) => d.id !== reassignDialog?.developerId)
      .slice()
      .sort(
        (a, b) =>
          (order[a.availability] ?? 3) - (order[b.availability] ?? 3) ||
          a.activeTasks / Math.max(1, a.maxCapacity) - b.activeTasks / Math.max(1, b.maxCapacity),
      );
  }, [developers, reassignDialog]);

  const handleExport = () => {
    downloadCsv(
      'active-tasks',
      visibleTasks.map((t) => ({ ...t })),
      [
        { key: 'code', label: 'Task Code' },
        { key: 'title', label: 'Title' },
        { key: 'assignedTo', label: 'Assigned To' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'slaHoursRemaining', label: 'SLA Hours Remaining' },
        { key: 'promiseId', label: 'Promise ID' },
      ],
    );
  };


  const closeDialog = () => {
    setReassignDialog(null);
    setNewAssignee('');
    setReassignReason('');
    setErrors({});
  };

  const validate = () => {
    const next: { assignee?: string; reason?: string } = {};
    if (!newAssignee) next.assignee = 'Select the developer who will take this task.';
    if (reassignReason.trim().length < 5)
      next.reason = 'A reason of at least 5 characters is required for the audit trail.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const canSubmit = !!newAssignee && reassignReason.trim().length >= 5;

  const handleReassign = async () => {
    if (!reassignDialog) return;
    if (!validate()) {
      toast({
        title: 'Reassignment blocked',
        description: 'Fix the highlighted fields before confirming.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await reassign.mutateAsync({
        taskId: reassignDialog.id,
        newDeveloperId: newAssignee,
        reason: reassignReason.trim(),
      });
      closeDialog();
    } catch {
      // failure surfaced by the mutation's error toast
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3 gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <CardTitle className="truncate text-sm font-mono tracking-wider text-muted-foreground">
              ACTIVE TASKS BY DEVELOPER
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {visibleTasks.length}/{tasks.length}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
                disabled={visibleTasks.length === 0}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search tasks, code or developer…"
                aria-label="Search active tasks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger aria-label="Filter by priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground font-mono">Loading live tasks…</p>}
          {error && (
            <p className="text-sm text-red-400 font-mono">
              {error instanceof Error ? error.message : 'Failed to load tasks'}
            </p>
          )}
          {visibleTasks.map((task, idx) => (

            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 bg-muted/40 rounded-lg border border-border"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
                    <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </Badge>
                    {task.promiseId && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {task.promiseId}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium">{task.title}</h4>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-mono">{task.assignedTo}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className={task.slaHoursRemaining <= 4 ? 'text-red-400' : ''}>
                      {task.slaHoursRemaining}h remaining
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-xs"
                  onClick={() => setReassignDialog(task)}
                >
                  <RefreshCw className="w-3 h-3" />
                  Reassign
                </Button>
              </div>

              {task.slaHoursRemaining <= 4 && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-2 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  SLA at risk - escalation may be required
                </div>
              )}
            </motion.div>
          ))}
          {!isLoading && !error && visibleTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0 ? 'No active tasks.' : 'No tasks match these filters.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reassign Dialog */}
      <Dialog
        open={!!reassignDialog}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="bg-card border-border"
          onEscapeKeyDown={() => closeDialog()}
        >
          <DialogHeader>
            <DialogTitle className="font-mono">
              Reassign Task {reassignDialog?.code}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Assignee</p>
              <p className="font-mono">{reassignDialog?.assignedTo}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="reassign-assignee" className="flex items-center gap-1 text-sm text-muted-foreground">
                New Assignee <span className="text-red-400" aria-hidden="true">*</span>
                <InfoHint text="Developers are ordered by availability. Anyone at or over capacity cannot receive new work." />
              </label>
              <Select
                value={newAssignee}
                onValueChange={(v) => {
                  setNewAssignee(v);
                  setErrors((e) => ({ ...e, assignee: undefined }));
                }}
              >
                <SelectTrigger
                  id="reassign-assignee"
                  aria-invalid={!!errors.assignee}
                  aria-describedby={errors.assignee ? 'reassign-assignee-error' : undefined}
                  className={`bg-muted border-border ${errors.assignee ? 'border-destructive ring-1 ring-destructive' : ''}`}
                >
                  <SelectValue placeholder="Select developer" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  {assignableDevelopers.map((dev) => {
                    const full = dev.activeTasks >= dev.maxCapacity;
                    return (
                      <SelectItem
                        key={dev.id}
                        value={dev.id}
                        disabled={full}
                        className="font-mono"
                      >
                        {dev.valaId} — {dev.activeTasks}/{dev.maxCapacity} ·{' '}
                        {full ? 'at capacity' : dev.availability}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.assignee && (
                <p id="reassign-assignee-error" className="text-xs text-destructive">
                  {errors.assignee}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="reassign-reason" className="flex items-center gap-1 text-sm text-muted-foreground">
                Reason <span className="text-red-400" aria-hidden="true">*</span>
                <InfoHint text="Stored in the audit trail against this task. Minimum 5 characters." />
              </label>
              <Textarea
                id="reassign-reason"
                value={reassignReason}
                onChange={(e) => {
                  setReassignReason(e.target.value);
                  setErrors((err) => ({ ...err, reason: undefined }));
                }}
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? 'reassign-reason-error' : undefined}
                placeholder="Mandatory: Explain why this task is being reassigned..."
                className={`bg-muted border-border min-h-[100px] ${errors.reason ? 'border-destructive ring-1 ring-destructive' : ''}`}
              />
              {errors.reason && (
                <p id="reassign-reason-error" className="text-xs text-destructive">
                  {errors.reason}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={reassign.isPending || !canSubmit}
              className="gap-2"
            >
              {reassign.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {reassign.isPending ? 'Saving…' : 'Confirm Reassignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
