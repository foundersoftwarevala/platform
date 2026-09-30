/**
 * ALERTS & ESCALATION
 * Delay Alert • Security Alert • Performance Alert
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Shield, TrendingDown } from 'lucide-react';
import { useDeliveryOverview } from '@/hooks/useDevManagerData';

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'delay': return <Clock className="h-4 w-4" />;
    case 'security': return <Shield className="h-4 w-4" />;
    case 'performance': return <TrendingDown className="h-4 w-4" />;
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
 */
export const DMAlertsEscalation: React.FC = () => {
  const overview = useDeliveryOverview();
  const d = overview.data;
  const delay = [
    ...(d?.risks ?? []).map((r) => ({
      id: r.code, type: 'delay', severity: r.riskLevel === 'moderate' ? 'medium' : r.riskLevel,
      message: `${r.title}: ${r.hoursRemaining < 0 ? `${Math.abs(Math.round(r.hoursRemaining))} h past its SLA` : `${Math.round(r.hoursRemaining)} h left on its SLA`}`,
      dev: r.assignee || null, time: r.escalatedAt ? `escalated ${new Date(r.escalatedAt).toLocaleString()}` : '',
    })),
    ...(d?.blocked ?? []).map((b) => ({
      id: b.code, type: 'delay', severity: b.escalated ? 'critical' : 'high',
      message: `${b.title} is blocked: ${b.blockedReason}`,
      dev: b.assignee || null, time: `blocked ${Math.round(b.blockedHours)} h`,
    })),
  ];
  const performance = (d?.performance ?? []).filter((p) => p.trend === 'down').map((p) => ({
    id: p.valaId, type: 'performance', severity: 'medium',
    message: `On-time rate ${Math.round(p.onTimeRate)}%, quality ${Math.round(p.qualityScore)}%, trending down`,
    dev: p.valaId, time: '',
  }));
  const alerts = [...delay, ...performance];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerts & Escalation</h1>
        <p className="text-muted-foreground">System alerts and escalation queue</p>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{d ? delay.length : '—'}</div>
                <div className="text-sm text-muted-foreground">Delay Alerts</div>
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
                <div className="text-sm text-muted-foreground">Security Alerts (not tracked)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{d ? performance.length : '—'}</div>
                <div className="text-sm text-muted-foreground">Performance Alerts</div>
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
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(overview.isLoading || overview.isError || alerts.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {overview.isLoading ? 'Loading alerts…' : overview.isError ? `Alerts could not be read: ${(overview.error as Error).message}` : 'No active alert.'}
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
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{alert.type}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{alert.time}</span>
                </div>
                <p className="text-sm">{alert.message}</p>
                {alert.dev && (
                  <p className="text-xs text-muted-foreground mt-1">Developer: {alert.dev}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMAlertsEscalation;
