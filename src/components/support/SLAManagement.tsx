import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, AlertTriangle, CheckCircle, XCircle, Play, Pause, 
  Settings, Plus, Edit2, Trash2, ArrowUpRight, Timer, Shield 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';
import { supabase } from '@/integrations/supabase/client';
import { memberName, useInsertRow, useTeamMembers, useTickets, useUpdateRow } from '@/hooks/useSalesSupportData';

interface SLATemplate {
  id: string;
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  responseTime: number;
  resolutionTime: number;
  escalationLevels: number;
  isActive: boolean;
}

interface EscalationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  level: number;
  isAutomatic: boolean;
}

interface BreachAlert {
  id: string;
  ticketId: string;
  type: 'warning' | 'breach';
  slaType: string;
  timeRemaining: string;
  assignedTo: string;
}

const SLAManagement = () => {
  const { executeAction } = useGlobalActions();
  
  // No SLA policy or escalation rule is stored on the platform; these lists
  // held typed-in examples. They stay empty until a table holds them.
  const slaTemplates: SLATemplate[] = [];
  const escalationRules: EscalationRule[] = [];

  // Breaches are real: open tickets past, or within 30 minutes of, their SLA.
  const { data: ticketRows } = useTickets();
  const { data: members } = useTeamMembers('support');
  const updateTicket = useUpdateRow('support_tickets');
  const insertEscalation = useInsertRow('support_escalations');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breachAlerts: BreachAlert[] = ((ticketRows ?? []) as any[])
    .filter((t) => t.status !== 'resolved' && t.status !== 'closed')
    .filter((t) => t.sla_breached || (t.sla_minutes_remaining != null && t.sla_minutes_remaining <= 30))
    .map((t) => ({
      id: t.id,
      ticketId: t.reference ?? t.id.slice(0, 8),
      type: t.sla_breached ? 'breach' : 'warning',
      slaType: t.first_response_at ? 'Resolution' : 'Response',
      timeRemaining: t.sla_breached ? 'breached' : `${t.sla_minutes_remaining} min`,
      assignedTo: memberName(members, t.assigned_to) ?? 'Unassigned',
    }));

  const handleCreateTemplate = useCallback(async () => {
    await executeAction({
      actionId: 'create_sla_template',
      actionType: 'create',
      entityType: 'setting',
      metadata: { type: 'sla_template' },
      successMessage: 'SLA Template created',
    });
  }, [executeAction]);

  const handleToggleTemplate = useCallback(async (id: string, name: string, currentState: boolean) => {
    await executeAction({
      actionId: `toggle_sla_${id}`,
      actionType: 'toggle',
      entityType: 'setting',
      entityId: id,
      metadata: { name, enabled: !currentState },
      successMessage: `SLA Template ${!currentState ? 'enabled' : 'disabled'}`,
    });
  }, [executeAction]);

  // Escalating raises the ticket to critical and records the escalation.
  const handleEscalate = async (ticketRef: string) => {
    const alert = breachAlerts.find((x) => x.ticketId === ticketRef);
    if (!alert) return;
    try {
      const { data } = await supabase.auth.getUser();
      await insertEscalation.mutateAsync({
        ticket_id: alert.id, reference: alert.ticketId, reason: 'SLA breach prevention',
        level: 1, status: 'open', raised_by: data.user?.id ?? null,
      });
      await updateTicket.mutateAsync({ id: alert.id, values: { priority: 'critical', updated_at: new Date().toISOString() } });
      toast.success(`${alert.ticketId} escalated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The ticket could not be escalated');
    }
  };

  const handleAdminOverride = useCallback(async (ticketId: string) => {
    await executeAction({
      actionId: `admin_override_${ticketId}`,
      actionType: 'approve',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { action: 'admin_override' },
      successMessage: 'Admin override applied',
    });
  }, [executeAction]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      default: return 'text-muted-foreground bg-muted/40 border-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">SLA Management</h2>
          <p className="text-muted-foreground text-sm">Configure SLA templates, escalation rules, and breach alerts</p>
        </div>
        <Button onClick={handleCreateTemplate} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30">
          <Plus className="w-4 h-4 mr-2" />
          New SLA Template
        </Button>
      </div>

      {/* Active Breach Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-foreground">Active Alerts</h3>
          <Badge className="bg-red-500/20 text-red-400">{breachAlerts.length} Active</Badge>
        </div>

        <div className="space-y-3">
          {breachAlerts.length === 0 && <p className="text-sm text-muted-foreground">No open ticket is past or near its SLA.</p>}
          {breachAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-center justify-between ${
                alert.type === 'breach' 
                  ? 'bg-red-500/5 border-red-500/30' 
                  : 'bg-yellow-500/5 border-yellow-500/30'
              }`}
            >
              <div className="flex items-center gap-4">
                {alert.type === 'breach' ? (
                  <XCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{alert.ticketId}</span>
                    <Badge className={alert.type === 'breach' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                      {alert.type === 'breach' ? 'BREACHED' : 'WARNING'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {alert.slaType} SLA • Assigned to {alert.assignedTo}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-sm ${alert.type === 'breach' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {alert.timeRemaining}
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleEscalate(alert.ticketId)}
                  className="text-orange-400 hover:bg-orange-500/10"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleAdminOverride(alert.ticketId)}
                  className="text-teal-400 hover:bg-teal-500/10"
                >
                  <Shield className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* SLA Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Timer className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-foreground">SLA Templates</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slaTemplates.length === 0 && <p className="text-sm text-muted-foreground">No SLA policy is stored on the platform yet. Each ticket carries its own SLA time.</p>}
          {slaTemplates.map((template) => (
            <motion.div
              key={template.id}
              whileHover={{ scale: 1.01 }}
              className={`p-4 rounded-xl border ${getPriorityColor(template.priority)} bg-opacity-50`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-semibold text-foreground">{template.name}</span>
                </div>
                <Switch 
                  checked={template.isActive}
                  onCheckedChange={() => handleToggleTemplate(template.id, template.name, template.isActive)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-card/60 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Response</p>
                  <p className="text-foreground font-mono">{template.responseTime}m</p>
                </div>
                <div className="bg-card/60 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Resolution</p>
                  <p className="text-foreground font-mono">{template.resolutionTime}m</p>
                </div>
                <div className="bg-card/60 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Levels</p>
                  <p className="text-foreground font-mono">L{template.escalationLevels}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" className="flex-1 text-teal-400 hover:bg-teal-500/10">
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Escalation Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-foreground">Escalation Rules</h3>
          </div>
          <Button size="sm" className="bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30">
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-3">
          {escalationRules.length === 0 && <p className="text-sm text-muted-foreground">No automatic escalation rule is stored yet. Tickets are escalated by hand.</p>}
          {escalationRules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-xl bg-card/60 border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  rule.isAutomatic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/40 text-muted-foreground'
                }`}>
                  L{rule.level}
                </div>
                <div>
                  <p className="font-medium text-foreground">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Trigger: {rule.trigger} → {rule.action}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={rule.isAutomatic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/40 text-muted-foreground'}>
                  {rule.isAutomatic ? 'Auto' : 'Manual'}
                </Badge>
                <Switch checked={rule.isAutomatic} />
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default SLAManagement;
