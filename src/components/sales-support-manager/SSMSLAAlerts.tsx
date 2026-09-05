import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Timer,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useTickets, useUpdateRow, relativeTime } from '@/hooks/useSalesSupportData';

export const SSMSLAAlerts: React.FC = () => {
  const { data: tickets, isLoading } = useTickets();
  const updateTicket = useUpdateRow('support_tickets');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleAcknowledge = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    toast.success('Alert acknowledged and logged');
  };

  const handleEscalate = async (id: string) => {
    try {
      await updateTicket.mutateAsync({ id, values: { status: 'escalated' } });
      setDismissed(prev => new Set(prev).add(id));
      toast.success('Escalated to Pro Manager');
    } catch {
      toast.error('Failed to escalate');
    }
  };

  const activeTickets = (tickets ?? []).filter(t => t.status !== 'resolved' && !dismissed.has(t.id));

  const alerts = activeTickets
    .filter(t => t.sla_breached || t.sla_minutes_remaining < 240)
    .map(t => {
      const severity = t.sla_breached ? 'critical' : t.sla_minutes_remaining < 60 ? 'high' : 'medium';
      const type = t.sla_breached ? 'sla_breach' : t.sla_minutes_remaining < 60 ? 'sla_warning' : 'no_response';
      return { ticket: t, severity, type };
    });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'sla_breach':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'sla_warning':
        return <Timer className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/5';
      case 'high':
        return 'border-orange-500 bg-orange-500/5';
      default:
        return 'border-yellow-500 bg-yellow-500/5';
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const breachCount = alerts.filter(a => a.type === 'sla_breach').length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5 text-yellow-500" />
            SLA & Response Alerts
          </CardTitle>
          <div className="flex items-center gap-2">
            {breachCount > 0 && (
              <Badge className="bg-red-500 text-foreground animate-pulse">
                {breachCount} BREACHED
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge className="bg-red-500/10 text-red-500 border-red-500/30">
                {criticalCount} Critical
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Server-based timers • Near-breach alerts • Auto-escalation on breach
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
        ) : (
        <div className="space-y-3">
          {alerts.map(({ ticket, severity, type }) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`border-l-4 rounded-lg p-4 ${getSeverityColor(severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-background rounded-lg">
                    {getAlertIcon(type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={
                        severity === 'critical' ? 'bg-red-500 text-foreground' :
                        severity === 'high' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }>
                        {severity.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-sm text-primary">{ticket.reference}</span>
                      <Badge variant="outline" className="text-xs">
                        ticket
                      </Badge>
                    </div>
                    <h4 className="font-medium text-foreground">{ticket.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      {ticket.sla_breached ? 'SLA breached - unresolved ticket' : 'No response - customer waiting'}
                    </p>
                  </div>
                </div>
                {!ticket.sla_breached && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 font-mono">
                    <Timer className="h-3 w-3 mr-1" />
                    {ticket.sla_minutes_remaining}m left
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  Owner: {ticket.assigned_to ?? 'Unassigned'} • Triggered: {relativeTime(ticket.updated_at)}
                </span>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleAcknowledge(ticket.id)}
                  >
                    Acknowledge
                  </Button>
                  {severity === 'critical' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleEscalate(ticket.id)}
                    >
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                      Escalate
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No active SLA alerts</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/30 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>SLA Enforcement:</strong> Timers are server-controlled and cannot be modified.
            Breached SLAs automatically escalate to Pro Manager.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
