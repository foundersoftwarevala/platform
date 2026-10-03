/**
 * ALERTS & ESCALATION
 * Delay Alert • Security Alert • Performance Alert
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle, Clock, Shield, TrendingDown } from 'lucide-react';
import { useDeliveryOverview, useUpdateEscalation } from '@/hooks/useDevManagerData';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { MessageKey } from '@/lib/i18n/messages';
import { useDMPrompt } from '../DMPromptDialog';

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };

const SEVERITY_KEYS: Record<string, MessageKey> = {
  critical: 'devmanager.alerts.severity_critical',
  high: 'devmanager.alerts.severity_high',
  medium: 'devmanager.alerts.severity_medium',
  low: 'devmanager.alerts.severity_low',
};

const TYPE_KEYS: Record<string, MessageKey> = {
  delay: 'devmanager.alerts.type_delay',
  performance: 'devmanager.alerts.type_performance',
  escalation: 'devmanager.alerts.type_escalation',
  security: 'devmanager.alerts.type_security',
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'delay': return <Clock className="h-4 w-4" />;
    case 'security': return <Shield className="h-4 w-4" />;
    case 'performance': return <TrendingDown className="h-4 w-4" />;
    case 'escalation': return <AlertTriangle className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-500';
    case 'high': return 'bg-amber-500/10 border-amber-500/30 text-amber-500';
    case 'medium': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
    case 'low': return 'bg-blue-500/10 border-blue-500/30 text-blue-500';
    default: return 'bg-muted';
  }
};

/**
 * Alerts, from the delivery overview.
 *
 * The four alerts here were typed in. Delay alerts are now the tasks at SLA
 * risk and the blocked tasks; performance alerts are developers whose trend is
 * down. Security alerts for developers are not recorded anywhere, so that
 * count is shown as not tracked rather than as a number.
 *
 * Open escalations (developer_task_escalations, raised by hand or by the SLA
 * sweep) are alerts too. They were loaded but never shown, so nobody could
 * acknowledge or resolve one; both now go through the audited server function.
 */
export const DMAlertsEscalation: React.FC = () => {
  const { t, formatDate, formatNumber } = useTranslation();
  const prompt = useDMPrompt();
  const overview = useDeliveryOverview();
  const update = useUpdateEscalation();
  const d = overview.data;
  const delay = [
    ...(d?.risks ?? []).map((r) => ({
      id: r.code, type: 'delay', severity: r.riskLevel === 'moderate' ? 'medium' : r.riskLevel,
      message: r.hoursRemaining < 0
        ? t('devmanager.alerts.sla_past', { title: r.title, hours: formatNumber(Math.abs(Math.round(r.hoursRemaining))) })
        : t('devmanager.alerts.sla_left', { title: r.title, hours: formatNumber(Math.round(r.hoursRemaining)) }),
      dev: r.assignee || null, time: r.escalatedAt ? t('devmanager.alerts.escalated_at', { time: formatDate(r.escalatedAt, DATE_TIME) }) : '',
    })),
    ...(d?.blocked ?? []).map((b) => ({
      id: b.code, type: 'delay', severity: b.escalated ? 'critical' : 'high',
      message: t('devmanager.alerts.blocked_message', { title: b.title, reason: b.blockedReason }),
      dev: b.assignee || null, time: t('devmanager.alerts.blocked_for', { hours: formatNumber(Math.round(b.blockedHours)) }),
    })),
  ];
  const performance = (d?.performance ?? []).filter((p) => p.trend === 'down').map((p) => ({
    id: p.valaId, type: 'performance', severity: 'medium',
    message: t('devmanager.alerts.performance_message', {
      onTime: formatNumber(Math.round(p.onTimeRate)),
      quality: formatNumber(Math.round(p.qualityScore)),
    }),
    dev: p.valaId, time: '',
  }));
  const escalations = (d?.escalations ?? [])
    .filter((e) => e.status === 'pending' || e.status === 'acknowledged')
    .map((e) => ({
      id: e.taskCode || e.shortId, type: 'escalation', severity: e.status === 'pending' ? 'high' : 'medium',
      message: e.reason,
      dev: null as string | null,
      time: t('devmanager.alerts.escalation_time', {
        kind: e.autoEscalated ? 'auto' : 'manual',
        time: formatDate(e.escalatedAt, DATE_TIME),
        status: e.status,
      }),
      escalation: e,
    }));
  const decide = async (escalationId: string, status: 'acknowledged' | 'resolved') => {
    let resolution: string | null = null;
    if (status === 'resolved') {
      const answer = await prompt.ask({
        title: t('devmanager.alerts.resolve_prompt'),
        reasonLabel: t('devmanager.alerts.resolution_label'),
        minLength: 5,
        confirmLabel: t('devmanager.alerts.resolve'),
      });
      if (!answer) return;
      resolution = answer.reason?.trim() ?? '';
      if (resolution.length < 5) { toast.error(t('devmanager.alerts.resolution_too_short')); return; }
    }
    update.mutate({ escalationId, status, resolution });
  };
  const alerts: Array<(typeof delay)[number] & { escalation?: (typeof escalations)[number]['escalation'] }> = [
    ...escalations,
    ...delay,
    ...performance,
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.alerts.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.alerts.subtitle')}</p>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{d ? formatNumber(delay.length) : '—'}</div>
                <div className="text-sm text-muted-foreground">{t('devmanager.alerts.delay_alerts')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">—</div>
                <div className="text-sm text-muted-foreground">{t('devmanager.alerts.security_alerts')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{d ? formatNumber(performance.length) : '—'}</div>
                <div className="text-sm text-muted-foreground">{t('devmanager.alerts.performance_alerts')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('devmanager.alerts.active_alerts')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(overview.isLoading || overview.isError || alerts.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={overview.isError ? 'alert' : 'status'}
                aria-live={overview.isError ? undefined : 'polite'}
                aria-busy={overview.isLoading || undefined}
              >
                {overview.isLoading
                  ? t('devmanager.alerts.loading')
                  : overview.isError
                    ? t('devmanager.alerts.load_error', { error: (overview.error as Error).message })
                    : t('devmanager.alerts.empty')}
              </p>
            )}
            {alerts.map((alert) => (
              <div
                key={`${alert.type}-${alert.id}-${alert.message}`}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(alert.type)}
                    <span className="font-mono text-sm">{alert.id}</span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {SEVERITY_KEYS[alert.severity] ? t(SEVERITY_KEYS[alert.severity]) : alert.severity}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {TYPE_KEYS[alert.type] ? t(TYPE_KEYS[alert.type]) : alert.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.time}</span>
                </div>
                <p className="text-sm">{alert.message}</p>
                {alert.dev && (
                  <p className="text-xs text-muted-foreground mt-1">{t('devmanager.alerts.developer', { dev: alert.dev })}</p>
                )}
                {alert.escalation && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {alert.escalation.status === 'pending' && (
                      <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => void decide(alert.escalation!.id, 'acknowledged')}>
                        {t('devmanager.alerts.acknowledge')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => void decide(alert.escalation!.id, 'resolved')}>
                      {t('devmanager.alerts.resolve')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {prompt.dialog}
    </div>
  );
};

export default DMAlertsEscalation;
