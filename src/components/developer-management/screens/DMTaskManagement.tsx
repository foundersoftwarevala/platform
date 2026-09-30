/**
 * TASK MANAGEMENT (CORE)
 * New • Assigned • In Progress • Blocked • Completed
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListTodo, UserPlus, RefreshCw, Pause, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDeliveryOverview, useEscalateTask, useReassignTask } from '@/hooks/useDevManagerData';

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'critical': return <Badge variant="destructive">Critical</Badge>;
    case 'high': return <Badge className="bg-red-500/20 text-red-500">High</Badge>;
    case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">Medium</Badge>;
    case 'low': return <Badge variant="secondary">Low</Badge>;
    default: return <Badge>{priority}</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'new': return <Badge className="bg-blue-500/20 text-blue-500">New</Badge>;
    case 'assigned': return <Badge className="bg-cyan-500/20 text-cyan-500">Assigned</Badge>;
    case 'in_progress': return <Badge className="bg-green-500/20 text-green-500">In Progress</Badge>;
    case 'blocked': return <Badge className="bg-red-500/20 text-red-500">Blocked</Badge>;
    case 'completed': return <Badge variant="secondary">Completed</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

/**
 * Developer tasks, from the delivery overview (developer_tasks).
 *
 * The five tasks here were typed in, and every button only showed a message.
 * Assign and reassign now move the task to the developer chosen, and escalate
 * records an escalation - both audited by the Dev Manager's server functions.
 * Pausing and closing belong to the developer's own workflow, so those say so.
 */
export const DMTaskManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const overview = useDeliveryOverview();
  const reassign = useReassignTask();
  const escalate = useEscalateTask();
  const developers = overview.data?.developers ?? [];
  const tasks = (overview.data?.tasks ?? []).map((t) => ({
    id: t.code,
    uuid: t.id,
    project: t.title,
    module: t.promiseId ? 'Promise-linked' : '',
    priority: t.priority,
    deadline: t.dueDate ? t.dueDate.slice(0, 10) : '—',
    dependency: 'None',
    status: t.status === 'pending' ? (t.developerId ? 'assigned' : 'new') : t.status === 'review' ? 'in_progress' : t.status,
    assignee: t.developerId ? t.assignedTo : null,
  }));

  const pickDeveloper = (current: string | null) => {
    const choices = developers.filter((d) => d.fullName !== current);
    if (!choices.length) { toast.error('No other developer is registered.'); return null; }
    const answer = window.prompt(`Assign to which developer?\n${choices.map((d, i) => `${i + 1}. ${d.fullName} (${d.activeTasks} open)`).join('\n')}`);
    const index = Number(answer) - 1;
    return choices[index] ?? null;
  };
  const moveTask = (taskId: string, current: string | null) => {
    const developer = pickDeveloper(current);
    if (!developer) return;
    const reason = window.prompt('Why is it moving? (at least 5 characters)')?.trim();
    if (!reason || reason.length < 5) { toast.error('A reason of at least 5 characters is needed.'); return; }
    reassign.mutate({ taskId, newDeveloperId: developer.id, reason });
  };
  const escalateTask = (taskId: string) => {
    const reason = window.prompt('Why is it being escalated? (at least 5 characters)')?.trim();
    if (!reason || reason.length < 5) { toast.error('A reason of at least 5 characters is needed.'); return; }
    escalate.mutate({ taskId, reason });
  };

  const filteredTasks = tasks.filter(task => 
    activeTab === 'all' || task.status === activeTab
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Task Management</h1>
        <p className="text-muted-foreground">Manage developer tasks and assignments</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="blocked">Blocked</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Task List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(overview.isLoading || overview.isError || filteredTasks.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {overview.isLoading
                      ? 'Loading tasks…'
                      : overview.isError
                        ? `Tasks could not be read: ${(overview.error as Error).message}`
                        : activeTab === 'completed'
                          ? 'Completed tasks are not part of the open delivery view.'
                          : 'No task here.'}
                  </p>
                )}
                {filteredTasks.map((task) => (
                  <div 
                    key={task.id}
                    className={`p-4 rounded-lg border ${task.status === 'blocked' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-medium">{task.id}</span>
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {task.project} / {task.module} • Deadline: {task.deadline}
                        </p>
                        {task.dependency !== 'None' && (
                          <p className="text-xs text-muted-foreground">Depends on: {task.dependency}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {task.assignee ? (
                          <span className="font-mono text-sm">{task.assignee}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={reassign.isPending} onClick={() => moveTask(task.uuid, task.assignee)}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Assign
                      </Button>
                      <Button size="sm" variant="outline" disabled={reassign.isPending || !task.assignee} onClick={() => moveTask(task.uuid, task.assignee)}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reassign
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info('A task is paused by the developer working it, from their own dashboard.')}>
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                      <Button size="sm" variant="outline" disabled={escalate.isPending} onClick={() => escalateTask(task.uuid)}>
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Escalate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info('A task is closed when its work is approved in review, not from here.')}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Close
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DMTaskManagement;
