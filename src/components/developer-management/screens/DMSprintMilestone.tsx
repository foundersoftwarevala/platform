/**
 * SPRINT / MILESTONE
 * Sprint Planning • Milestone Tracking • Delay Prediction (AI) • Risk Alerts
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Calendar, Brain, AlertTriangle } from 'lucide-react';
import { useDeliveryOverview } from '@/hooks/useDevManagerData';
import { richText, useTranslation } from '@/lib/i18n/use-translation';

/**
 * Sprints and milestones. Two sprints, three milestones, a "3 days" AI
 * prediction and two risk alerts were typed in here. The platform keeps no
 * sprint or milestone for developer work, so those lists say so rather than
 * invent any, and no prediction is claimed. The risk alerts are real: the
 * tasks at SLA risk and the blocked tasks from the delivery overview.
 */
export const DMSprintMilestone: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const overview = useDeliveryOverview();
  const sprints: { id: string; name: string; start: string; end: string; progress: number; tasks: number; completed: number; status: string }[] = [];
  const milestones: { id: string; name: string; deadline: string; progress: number; status: string }[] = [];
  const riskAlerts = [
    ...(overview.data?.blocked ?? []).map((b) => ({
      task: b.code,
      reason: t('devmanager.sprint.blocked_reason', { reason: b.blockedReason }),
      delay: t('devmanager.sprint.hours_blocked', { hours: formatNumber(Math.round(b.blockedHours)) }),
    })),
    ...(overview.data?.risks ?? []).map((r) => ({
      task: r.code,
      reason: r.title,
      delay: r.hoursRemaining < 0
        ? t('devmanager.sprint.hours_late', { hours: formatNumber(Math.abs(Math.round(r.hoursRemaining))) })
        : t('devmanager.sprint.hours_left', { hours: formatNumber(Math.round(r.hoursRemaining)) }),
    })),
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.sprint.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.sprint.subtitle')}</p>
      </div>

      {/* Sprint Planning */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('devmanager.sprint.planning')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sprints.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('devmanager.sprint.sprints_empty')}
              </p>
            )}
            {sprints.map((sprint) => (
              <div key={sprint.id} className="p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{sprint.id}</span>
                    <span className="font-medium">{sprint.name}</span>
                    <Badge variant={sprint.status === 'active' ? 'default' : 'secondary'}>
                      {sprint.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{sprint.start} → {sprint.end}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={sprint.progress} className="flex-1 h-2" aria-label={sprint.name} />
                  <span className="text-sm">{t('devmanager.sprint.tasks_done', { completed: sprint.completed, total: sprint.tasks })}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Milestone Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('devmanager.sprint.milestones')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestones.length === 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {t('devmanager.sprint.milestones_empty')}
              </p>
            )}
            {milestones.map((ms) => (
              <div key={ms.id} className={`p-4 rounded-lg border ${ms.status === 'at_risk' ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{ms.name}</span>
                    <Badge variant={ms.status === 'at_risk' ? 'destructive' : 'default'}>
                      {ms.status === 'at_risk' ? t('devmanager.sprint.at_risk') : t('devmanager.sprint.on_track')}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{t('devmanager.sprint.due', { date: ms.deadline })}</span>
                </div>
                <Progress value={ms.progress} className="h-2" aria-label={ms.name} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Delay Prediction */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-purple-500">
              <Brain className="h-5 w-5" />
              {t('devmanager.sprint.ai_prediction')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-500 mb-2">—</div>
              <p className="text-sm text-muted-foreground">{t('devmanager.sprint.ai_prediction_none')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              {t('devmanager.sprint.risk_alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskAlerts.length === 0 && (
                <p
                  className="text-sm text-muted-foreground"
                  role={!overview.isLoading && overview.isError ? 'alert' : 'status'}
                  aria-live={!overview.isLoading && overview.isError ? undefined : 'polite'}
                  aria-busy={overview.isLoading || undefined}
                >
                  {overview.isLoading
                    ? t('devmanager.common.loading')
                    : overview.isError
                      ? t('devmanager.sprint.risks_error')
                      : t('devmanager.sprint.risks_empty')}
                </p>
              )}
              {riskAlerts.map((alert, idx) => (
                <div key={idx} className="p-2 bg-background rounded text-sm">
                  {richText(t('devmanager.sprint.risk_line'), {
                    task: <span className="font-mono">{alert.task}</span>,
                    reason: alert.reason,
                    delay: alert.delay,
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DMSprintMilestone;
