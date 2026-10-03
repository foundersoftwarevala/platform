/**
 * DEVELOPER REGISTRY
 * All Developers • Active • Suspended • Probation • Exited
 * DEBUG FIX: Connected to action logger for full traceability
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Eye, ListTodo, Ban, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useActionLogger } from '@/hooks/useActionLogger';
import { useServerFn } from '@tanstack/react-start';
import { escalateDeveloper } from '@/lib/dev-manager.functions';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmAction } from '@/components/dev-manager/ui-helpers';
import {
  useDeliveryOverview,
  useDeveloperRegistry,
  useReassignTask,
  useSetDeveloperStatus,
} from '@/hooks/useDevManagerData';
import { useTranslation, type Translate } from '@/lib/i18n/use-translation';
import { useDMPrompt } from '../DMPromptDialog';


const getStatusBadge = (status: string, t: Translate) => {
  switch (status) {
    case 'active': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.registry.status_active')}</Badge>;
    case 'suspended': return <Badge className="bg-red-500/20 text-red-500">{t('devmanager.registry.status_suspended')}</Badge>;
    case 'probation': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.registry.status_probation')}</Badge>;
    case 'exited': return <Badge variant="secondary">{t('devmanager.registry.status_exited')}</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

export const DMDeveloperRegistry: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const prompt = useDMPrompt();
  const [activeTab, setActiveTab] = useState('all');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { logAction } = useActionLogger();
  const escalateDev = useServerFn(escalateDeveloper);
  const { data: registry, isLoading, error } = useDeveloperRegistry();
  const setStatus = useSetDeveloperStatus();
  const overview = useDeliveryOverview();
  const reassign = useReassignTask();

  const developers = (registry ?? []).map((d) => ({
    id: d.id,
    valaId: d.valaId,
    role: d.skillTags[0] ?? t('devmanager.registry.role_default'),
    location: d.email.split('@')[1] ? `***-${d.email.split('@')[1]?.slice(0, 2).toUpperCase()}` : '***',
    skills: d.skillTags,
    level: t('devmanager.registry.load', { active: d.activeTasks, max: d.maxCapacity }),
    status: d.status,
  }));

  const filteredDevs = developers.filter((dev) => activeTab === 'all' || dev.status === activeTab);

  // View Developer - READ action with logging
  const handleViewDeveloper = useCallback(async (devId: string) => {
    const startTime = performance.now();
    setLoadingAction(`view-${devId}`);

    try {
      // Log READ action
      await logAction({
        buttonId: `dm_view_developer_${devId}`,
        moduleName: 'developer_management',
        actionType: 'READ',
        actionResult: 'success',
        responseTimeMs: Math.round(performance.now() - startTime),
        metadata: { developerId: devId, action: 'view' }
      });

      const dev = (registry ?? []).find((d) => d.id === devId);
      if (!dev) throw new Error('Developer not found');
      toast.info(`${dev.valaId} · ${dev.fullName}`, {
        description: [
          dev.onboardingCompleted
            ? t('devmanager.registry.view_status', { status: dev.status })
            : t('devmanager.registry.view_status_onboarding', { status: dev.status }),
          t('devmanager.registry.view_open_tasks', { active: dev.activeTasks, max: dev.maxCapacity }),
          dev.skillTags.length
            ? t('devmanager.registry.view_skills', { skills: dev.skillTags.join(', ') })
            : t('devmanager.registry.view_skills_none'),
          dev.joinedAt ? t('devmanager.registry.view_joined', { date: formatDate(dev.joinedAt) }) : null,
        ].filter(Boolean).join(' · '),
      });
    } catch (error) {
      await logAction({
        buttonId: `dm_view_developer_${devId}`,
        moduleName: 'developer_management',
        actionType: 'READ',
        actionResult: 'failure',
        responseTimeMs: Math.round(performance.now() - startTime),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error(t('devmanager.registry.view_failed'));
    } finally {
      setLoadingAction(null);
    }
  }, [logAction, registry, t, formatDate]);

  // Assign Task: moves an open task to this developer through the Dev Manager
  // server function (reassignTask), which records who assigned it and writes
  // the audit trail. It used to insert a placeholder task from the browser,
  // which row-level security refused every time.
  const handleAssignTask = useCallback(async (devId: string) => {
    const open = (overview.data?.tasks ?? []).filter((t) => t.developerId !== devId);
    if (!open.length) {
      toast.error(t('devmanager.registry.no_open_task'), { description: t('devmanager.registry.no_open_task_detail') });
      return;
    }
    const answer = await prompt.ask({
      title: t('devmanager.registry.assign_prompt'),
      choiceLabel: t('devmanager.registry.task_label'),
      choices: open.map((task) => ({
        value: task.id,
        label: task.developerId
          ? t('devmanager.registry.task_option_assigned', { code: task.code, title: task.title, assignee: task.assignedTo })
          : t('devmanager.registry.task_option', { code: task.code, title: task.title }),
      })),
      reasonLabel: t('devmanager.common.reason_why_developer'),
      minLength: 5,
      confirmLabel: t('devmanager.common.assign'),
    });
    if (!answer) return;
    const task = open.find((x) => x.id === answer.choice);
    if (!task) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    reassign.mutate({ taskId: task.id, newDeveloperId: devId, reason });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.data, reassign, prompt.ask, t]);

  // Escalate Issue - CREATE action with logging
  const handleEscalateIssue = useCallback(async (devId: string) => {
    const startTime = performance.now();
    setLoadingAction(`escalate-${devId}`);

    try {
      // Recorded in the audit trail by the Dev Manager server function, with
      // the verified operator as the actor; throws if it was not recorded.
      await escalateDev({ data: { developerId: devId } });

      await logAction({
        buttonId: `dm_escalate_issue_${devId}`,
        moduleName: 'developer_management',
        actionType: 'CREATE',
        actionResult: 'success',
        responseTimeMs: Math.round(performance.now() - startTime),
        metadata: { developerId: devId, action: 'escalate', severity: 'high' }
      });

      toast.error(t('devmanager.registry.escalated', { id: (registry ?? []).find((d) => d.id === devId)?.valaId ?? devId }), {
        description: t('devmanager.registry.escalated_detail')
      });
    } catch (error) {
      await logAction({
        buttonId: `dm_escalate_issue_${devId}`,
        moduleName: 'developer_management',
        actionType: 'CREATE',
        actionResult: 'failure',
        responseTimeMs: Math.round(performance.now() - startTime),
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error(t('devmanager.registry.escalate_failed'));
    } finally {
      setLoadingAction(null);
    }
  }, [escalateDev, logAction, registry, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.registry.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.registry.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">{t('devmanager.registry.tab_all', { count: developers.length })}</TabsTrigger>
          <TabsTrigger value="active">{t('devmanager.registry.status_active')}</TabsTrigger>
          <TabsTrigger value="suspended">{t('devmanager.registry.status_suspended')}</TabsTrigger>
          <TabsTrigger value="probation">{t('devmanager.registry.status_probation')}</TabsTrigger>
          <TabsTrigger value="exited">{t('devmanager.registry.status_exited')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('devmanager.registry.developer_list')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" aria-busy={isLoading || undefined}>
                {isLoading && (
                  <div className="space-y-3" role="status" aria-live="polite" aria-label={t('devmanager.registry.loading')}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                )}
                {error && (
                  <p className="py-6 text-center text-sm text-destructive" role="alert">
                    {error instanceof Error ? error.message : t('devmanager.registry.unavailable')}
                  </p>
                )}
                {!isLoading && !error && filteredDevs.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
                    {t('devmanager.registry.empty')}
                  </p>
                )}
                {filteredDevs.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-medium">{dev.valaId}</span>
                        {getStatusBadge(dev.status, t)}
                        <Badge variant="outline">{dev.role}</Badge>
                        <Badge variant="secondary">{dev.level}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{t('devmanager.registry.location', { location: dev.location })}</span>
                        <span>•</span>
                        <span>{t('devmanager.registry.skills', { skills: dev.skills.join(', ') })}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDeveloper(dev.id)}
                        disabled={loadingAction === `view-${dev.id}`}
                      >
                        {loadingAction === `view-${dev.id}` ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-1" />
                        )}
                        {t('devmanager.registry.view')}
                      </Button>
                      {(dev.status === 'suspended' || dev.status === 'exited') && (
                        <ConfirmAction
                          title={t('devmanager.registry.reactivate_title', { id: dev.valaId })}
                          description={t('devmanager.registry.reactivate_description')}
                          confirmLabel={t('devmanager.registry.reactivate')}
                          onConfirm={() =>
                            setStatus.mutate({
                              developerId: dev.id,
                              status: 'active',
                              reason: 'Reactivated from Developer Registry',
                            })
                          }
                        >
                          <Button size="sm" variant="outline" disabled={setStatus.isPending}>
                            {t('devmanager.registry.reactivate')}
                          </Button>
                        </ConfirmAction>
                      )}
                      {dev.status !== 'exited' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleAssignTask(dev.id)}
                            disabled={reassign.isPending || overview.isLoading}
                          >
                            {reassign.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <ListTodo className="h-4 w-4 mr-1" />
                            )}
                            {t('devmanager.common.assign')}
                          </Button>
                          {dev.status !== 'suspended' && (
                            <ConfirmAction
                              title={t('devmanager.registry.suspend_title', { id: dev.valaId })}
                              description={t('devmanager.registry.suspend_description')}
                              confirmLabel={t('devmanager.registry.suspend')}
                              onConfirm={() => {
                                setStatus.mutate({
                                  developerId: dev.id,
                                  status: 'suspended',
                                  reason: 'Suspended from Developer Registry',
                                });
                              }}
                            >
                              <Button size="sm" variant="outline" disabled={setStatus.isPending}>
                                {setStatus.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Ban className="h-4 w-4 mr-1" />
                                )}
                                {t('devmanager.registry.suspend')}
                              </Button>
                            </ConfirmAction>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEscalateIssue(dev.id)}
                            disabled={loadingAction === `escalate-${dev.id}`}
                          >
                            {loadingAction === `escalate-${dev.id}` ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 mr-1" />
                            )}
                            {t('devmanager.common.escalate')}
                          </Button>
                        </>
                      )}
                    </div>
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

export default DMDeveloperRegistry;
