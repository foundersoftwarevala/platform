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
import { useAllDeveloperTasks, useDeliveryOverview, useEscalateTask, useReassignTask } from '@/hooks/useDevManagerData';
import { taskCode } from '@/lib/dev-manager.types';
import { useTranslation, type Translate } from '@/lib/i18n/use-translation';
import { useDMPrompt } from '../DMPromptDialog';

// Due and completion dates are stored as UTC timestamps; the day shown is the
// UTC day, as it was when the date was cut from the timestamp.
const DAY: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' };

const getPriorityBadge = (priority: string, t: Translate) => {
  switch (priority) {
    case 'critical': return <Badge variant="destructive">{t('devmanager.level.critical')}</Badge>;
    case 'high': return <Badge className="bg-red-500/20 text-red-500">{t('devmanager.level.high')}</Badge>;
    case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.level.medium')}</Badge>;
    case 'low': return <Badge variant="secondary">{t('devmanager.level.low')}</Badge>;
    default: return <Badge>{priority}</Badge>;
  }
};

const getStatusBadge = (status: string, t: Translate) => {
  switch (status) {
    case 'new': return <Badge className="bg-blue-500/20 text-blue-500">{t('devmanager.status.new')}</Badge>;
    case 'assigned': return <Badge className="bg-cyan-500/20 text-cyan-500">{t('devmanager.status.assigned')}</Badge>;
    case 'in_progress': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.status.in_progress')}</Badge>;
    case 'blocked': return <Badge className="bg-red-500/20 text-red-500">{t('devmanager.status.blocked')}</Badge>;
    case 'completed': return <Badge variant="secondary">{t('devmanager.status.completed')}</Badge>;
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
  const { t, formatDate } = useTranslation();
  const prompt = useDMPrompt();
  const [activeTab, setActiveTab] = useState('all');
  const overview = useDeliveryOverview();
  const reassign = useReassignTask();
  const escalate = useEscalateTask();
  const developers = overview.data?.developers ?? [];
  const tasks = (overview.data?.tasks ?? []).map((t) => ({
    id: t.code,
    uuid: t.id,
    project: t.title,
    module: t.promiseId ? 'promise' : '',
    priority: t.priority,
    deadline: t.dueDate ? formatDate(t.dueDate, DAY) : '—',
    dependency: 'None',
    status: t.status === 'pending' ? (t.developerId ? 'assigned' : 'new') : t.status === 'review' ? 'in_progress' : t.status,
    assignee: t.developerId ? t.assignedTo : null,
    assigneeId: t.developerId,
  }));

  // The current assignee is matched by id: the row shows their Vala ID, not
  // their name, so comparing names never left them out of the choices.
  // The delivery overview holds open work only; completed tasks come from the
  // full task list, so the Completed tab shows real finished work.
  const allTasks = useAllDeveloperTasks();
  const valaIdOf = new Map(developers.map((d) => [d.id, d.valaId]));
  const completedTasks = (allTasks.data ?? [])
    .filter((t) => t.status === 'completed' || t.status === 'delivered')
    .map((t) => ({
      id: taskCode(t.id),
      uuid: t.id,
      project: t.title,
      module: '',
      priority: t.priority,
      deadline: t.completedAt ? formatDate(t.completedAt, DAY) : '—',
      dependency: 'None',
      status: 'completed',
      assignee: t.developerId ? (valaIdOf.get(t.developerId) ?? null) : null,
      assigneeId: t.developerId,
    }));

  const moveTask = async (taskId: string, currentId: string | null) => {
    const choices = developers.filter((d) => d.id !== currentId);
    if (!choices.length) { toast.error(t('devmanager.tasks.no_other_developer')); return; }
    const answer = await prompt.ask({
      title: t('devmanager.tasks.assign_prompt'),
      choiceLabel: t('devmanager.prompt.developer'),
      choices: choices.map((d) => ({
        value: d.id,
        label: t('devmanager.prompt.developer_option', { name: d.fullName, count: d.activeTasks }),
      })),
      reasonLabel: t('devmanager.tasks.move_reason'),
      minLength: 5,
      confirmLabel: t('devmanager.common.assign'),
    });
    if (!answer) return;
    const developer = choices.find((d) => d.id === answer.choice);
    if (!developer) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    reassign.mutate({ taskId, newDeveloperId: developer.id, reason });
  };
  const escalateTask = async (taskId: string) => {
    const answer = await prompt.ask({
      title: t('devmanager.common.escalate_prompt'),
      reasonLabel: t('devmanager.prompt.reason'),
      minLength: 5,
      confirmLabel: t('devmanager.common.escalate'),
    });
    if (!answer) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    escalate.mutate({ taskId, reason });
  };

  const filteredTasks = activeTab === 'completed'
    ? completedTasks
    : tasks.filter(task => activeTab === 'all' || task.status === activeTab);
  const listLoading = activeTab === 'completed' ? allTasks.isLoading : overview.isLoading;
  const listError = activeTab === 'completed' ? allTasks.error : overview.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.tasks.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.tasks.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t('devmanager.common.all')}</TabsTrigger>
          <TabsTrigger value="new">{t('devmanager.status.new')}</TabsTrigger>
          <TabsTrigger value="assigned">{t('devmanager.status.assigned')}</TabsTrigger>
          <TabsTrigger value="in_progress">{t('devmanager.status.in_progress')}</TabsTrigger>
          <TabsTrigger value="blocked">{t('devmanager.status.blocked')}</TabsTrigger>
          <TabsTrigger value="completed">{t('devmanager.status.completed')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                {t('devmanager.tasks.task_list')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(listLoading || listError || filteredTasks.length === 0) && (
                  <p
                    className="text-sm text-muted-foreground"
                    role={!listLoading && listError ? 'alert' : 'status'}
                    aria-live={!listLoading && listError ? undefined : 'polite'}
                    aria-busy={listLoading || undefined}
                  >
                    {listLoading
                      ? t('devmanager.tasks.loading')
                      : listError
                        ? t('devmanager.tasks.load_error', { error: (listError as Error).message })
                        : t('devmanager.tasks.empty')}
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
                          {getStatusBadge(task.status, t)}
                          {getPriorityBadge(task.priority, t)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {task.module
                            ? t('devmanager.tasks.line_module', {
                                project: task.project,
                                module: t('devmanager.tasks.module_promise'),
                                kind: task.status === 'completed' ? 'completed' : 'deadline',
                                date: task.deadline,
                              })
                            : t('devmanager.tasks.line', {
                                project: task.project,
                                kind: task.status === 'completed' ? 'completed' : 'deadline',
                                date: task.deadline,
                              })}
                        </p>
                        {task.dependency !== 'None' && (
                          <p className="text-xs text-muted-foreground">{t('devmanager.tasks.depends_on', { dependency: task.dependency })}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {task.assignee ? (
                          <span className="font-mono text-sm">{task.assignee}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('devmanager.tasks.unassigned')}</span>
                        )}
                      </div>
                    </div>

                    {task.status !== 'completed' && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={reassign.isPending} onClick={() => void moveTask(task.uuid, task.assigneeId)}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        {t('devmanager.common.assign')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={reassign.isPending || !task.assignee} onClick={() => void moveTask(task.uuid, task.assigneeId)}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {t('devmanager.tasks.reassign')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info(t('devmanager.tasks.pause_info'))}>
                        <Pause className="h-4 w-4 mr-1" />
                        {t('devmanager.tasks.pause')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={escalate.isPending} onClick={() => void escalateTask(task.uuid)}>
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {t('devmanager.common.escalate')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info(t('devmanager.tasks.close_info'))}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('devmanager.tasks.close')}
                      </Button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {prompt.dialog}
    </div>
  );
};

export default DMTaskManagement;
