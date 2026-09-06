/**
 * ALERTS & ESCALATION
 * Delay Alert • Security Alert • Performance Alert
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Shield, TrendingDown } from 'lucide-react';

const alerts = [
  { id: 'ALT-001', type: 'delay', message: 'Task TSK-004 delayed by 2 days', severity: 'high', dev: 'DEV-002', time: '10 min ago' },
  { id: 'ALT-002', type: 'security', message: 'Unusual login attempt detected', severity: 'critical', dev: 'DEV-004', time: '30 min ago' },
  { id: 'ALT-003', type: 'performance', message: 'Performance dropped below threshold', severity: 'medium', dev: 'DEV-004', time: '1 hour ago' },
  { id: 'ALT-004', type: 'delay', message: 'Sprint deadline at risk', severity: 'high', dev: null, time: '2 hours ago' },
];

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

export const DMAlertsEscalation: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerts & Escalation</h1>
        <p className="text-muted-foreground">System alerts and escalation queue</p>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">2</div>
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
                <div className="text-2xl font-bold">1</div>
                <div className="text-sm text-muted-foreground">Security Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">1</div>
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
            {alerts.map((alert) => (
              <div 
                key={alert.id}
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
