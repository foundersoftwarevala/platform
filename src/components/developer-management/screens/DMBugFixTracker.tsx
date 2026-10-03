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
import { useTranslation, type Translate } from '@/lib/i18n/use-translation';
import { useDMPrompt } from '../DMPromptDialog';

// developer_tasks.status, in this tracker's words.
const FIX_STATUS: Record<string, string> = {
  pending: 'open', assigned: 'open', accepted: 'open', reopened: 'open',
  working: 'in_progress', in_progress: 'in_progress', paused: 'in_progress', blocked: 'in_progress',
  submitted: 'fixed', review: 'fixed', testing: 'fixed', completed: 'verified',
};

const getSeverityBadge = (severity: string, t: Translate) => {
  switch (severity) {
    case 'critical': return <Badge variant="destructive">{t('devmanager.level.critical')}</Badge>;
    case 'high': return <Badge className="bg-red-500/20 text-red-500">{t('devmanager.level.high')}</Badge>;
    case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.level.medium')}</Badge>;
    case 'low': return <Badge variant="secondary">{t('devmanager.level.low')}</Badge>;
    default: return <Badge>{severity}</Badge>;
  }
};

const getStatusBadge = (status: string, t: Translate) => {
  switch (status) {
    case 'open': return <Badge className="bg-blue-500/20 text-blue-500">{t('devmanager.bugs.status_open')}</Badge>;
    case 'in_progress': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.status.in_progress')}</Badge>;
    case 'fixed': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.bugs.status_fixed')}</Badge>;
    case 'verified': return <Badge className="bg-emerald-500/20 text-emerald-500">{t('devmanager.bugs.status_verified')}</Badge>;
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
  const { t } = useTranslation();
  const prompt = useDMPrompt();
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
  const assignFix = async (taskId: string, current: string | null) => {
    const choices = devs.filter((d) => (d.valaId || d.fullName) !== current);
    if (!choices.length) { toast.error(t('devmanager.bugs.no_other_developer')); return; }
    const answer = await prompt.ask({
      title: t('devmanager.bugs.assign_prompt'),
      choiceLabel: t('devmanager.prompt.developer'),
      choices: choices.map((d) => ({
        value: d.id,
        label: t('devmanager.prompt.developer_option', { name: d.fullName, count: d.activeTasks }),
      })),
      reasonLabel: t('devmanager.common.reason_why_developer'),
      minLength: 5,
      confirmLabel: t('devmanager.bugs.assign_fix'),
    });
    if (!answer) return;
    const developer = choices.find((d) => d.id === answer.choice);
    if (!developer) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    reassign.mutate({ taskId, newDeveloperId: developer.id, reason });
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.bugs.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.bugs.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="h-5 w-5" />
            {t('devmanager.bugs.bug_list')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(tasks.isLoading || tasks.isError || bugs.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={tasks.isError ? 'alert' : 'status'}
                aria-live={tasks.isError ? undefined : 'polite'}
                aria-busy={tasks.isLoading || undefined}
              >
                {tasks.isLoading
                  ? t('devmanager.common.loading')
                  : tasks.isError
                    ? t('devmanager.bugs.load_error', { error: (tasks.error as Error).message })
                    : t('devmanager.bugs.empty')}
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
                    {getSeverityBadge(bug.severity, t)}
                    {getStatusBadge(bug.status, t)}
                  </div>
                  {bug.assignee && (
                    <span className="font-mono text-sm">{bug.assignee}</span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="text-sm">{bug.description}</p>
                  <p className="text-xs text-muted-foreground">{t('devmanager.bugs.linked_task', { task: bug.task })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reassign.isPending || bug.status === 'verified'}
                    onClick={() => void assignFix(bug.uuid, bug.assignee)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    {t('devmanager.bugs.assign_fix')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(t('devmanager.bugs.verify_info'))}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('devmanager.bugs.verify_fix')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(t('devmanager.bugs.close_info'))}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t('devmanager.bugs.close_bug')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {prompt.dialog}
    </div>
  );
};

export default DMBugFixTracker;
