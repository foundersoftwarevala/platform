/**
 * BUG & FIX TRACKER
 * Bug ID • Severity • Linked Task • Fix Status
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAllDeveloperTasks, useDeveloperRegistry, useReassignTask } from '@/hooks/useDevManagerData';

// developer_tasks.status, in this tracker's words.
const FIX_STATUS: Record<string, string> = {
  pending: 'open', assigned: 'open', accepted: 'open', reopened: 'open',
  working: 'in_progress', in_progress: 'in_progress', paused: 'in_progress', blocked: 'in_progress',
  submitted: 'fixed', review: 'fixed', testing: 'fixed', completed: 'verified',
};

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'critical': return <Badge variant="destructive">Critical</Badge>;
    case 'high': return <Badge className="bg-red-500/20 text-red-500">High</Badge>;
    case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">Medium</Badge>;
    case 'low': return <Badge variant="secondary">Low</Badge>;
    default: return <Badge>{severity}</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open': return <Badge className="bg-blue-500/20 text-blue-500">Open</Badge>;
    case 'in_progress': return <Badge className="bg-amber-500/20 text-amber-500">In Progress</Badge>;
    case 'fixed': return <Badge className="bg-green-500/20 text-green-500">Fixed</Badge>;
    case 'verified': return <Badge className="bg-emerald-500/20 text-emerald-500">Verified</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

/**
 * Bugs are developer tasks filed in the "bug" category. The five here were
 * typed in. Assigning a fix moves the task to the developer chosen (audited);
 * a fix is verified, and the bug closed, when its code submission is approved
 * in Review & QA, so those two buttons say so.
 */
export const DMBugFixTracker: React.FC = () => {
  const tasks = useAllDeveloperTasks();
  const registry = useDeveloperRegistry();
  const reassign = useReassignTask();
  const devs = (registry.data ?? []).filter((d) => d.status === 'active');
  const nameOf = (id: string | null) => {
    const d = (registry.data ?? []).find((x) => x.id === id);
    return d ? d.valaId || d.fullName : null;
  };
  const bugs = (tasks.data ?? []).filter((t) => t.category === 'bug').map((t) => ({
    id: `BUG-${t.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`,
    uuid: t.id,
    severity: t.priority === 'urgent' ? 'critical' : t.priority,
    task: `TSK-${t.id.replace(/-/g, '').slice(0, 4).toUpperCase()}`,
    description: t.title,
    assignee: nameOf(t.developerId),
    status: FIX_STATUS[t.status] ?? t.status,
  }));
  const assignFix = (taskId: string, current: string | null) => {
    const choices = devs.filter((d) => (d.valaId || d.fullName) !== current);
    if (!choices.length) { toast.error('No other active developer is registered.'); return; }
    const answer = window.prompt(`Assign the fix to which developer?\n${choices.map((d, i) => `${i + 1}. ${d.fullName} (${d.activeTasks} open)`).join('\n')}`);
    const developer = choices[Number(answer) - 1];
    if (!developer) return;
    const reason = window.prompt('Why this developer? (at least 5 characters)')?.trim();
    if (!reason || reason.length < 5) { toast.error('A reason of at least 5 characters is needed.'); return; }
    reassign.mutate({ taskId, newDeveloperId: developer.id, reason });
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bug & Fix Tracker</h1>
        <p className="text-muted-foreground">Track bugs and their resolution status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Bug List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(tasks.isLoading || tasks.isError || bugs.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {tasks.isLoading ? 'Loading…' : tasks.isError ? `Bugs could not be read: ${(tasks.error as Error).message}` : 'No task is filed as a bug.'}
              </p>
            )}
            {bugs.map((bug) => (
              <div 
                key={bug.uuid}
                className={`p-4 rounded-lg border ${
                  bug.severity === 'critical' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{bug.id}</span>
                    {getSeverityBadge(bug.severity)}
                    {getStatusBadge(bug.status)}
                  </div>
                  {bug.assignee && (
                    <span className="font-mono text-sm">{bug.assignee}</span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="text-sm">{bug.description}</p>
                  <p className="text-xs text-muted-foreground">Linked Task: {bug.task}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={reassign.isPending || bug.status === 'verified'}
                    onClick={() => assignFix(bug.uuid, bug.assignee)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign Fix
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info('A fix is verified by approving its code submission in Review & QA.')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Verify Fix
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info('A bug closes when its fix is approved in Review & QA.')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Close Bug
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMBugFixTracker;
