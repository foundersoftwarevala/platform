import { useState, useCallback } from 'react';
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
  
  const [slaTemplates] = useState<SLATemplate[]>([
    { id: '1', name: 'Critical SLA', priority: 'critical', responseTime: 15, resolutionTime: 60, escalationLevels: 3, isActive: true },
    { id: '2', name: 'High Priority SLA', priority: 'high', responseTime: 30, resolutionTime: 120, escalationLevels: 2, isActive: true },
    { id: '3', name: 'Medium Priority SLA', priority: 'medium', responseTime: 60, resolutionTime: 240, escalationLevels: 2, isActive: true },
    { id: '4', name: 'Low Priority SLA', priority: 'low', responseTime: 120, resolutionTime: 480, escalationLevels: 1, isActive: false },
  ]);

  const [escalationRules] = useState<EscalationRule[]>([
    { id: '1', name: 'L1 to L2 Auto', trigger: '50% response time exceeded', action: 'Escalate to L2', level: 2, isAutomatic: true },
    { id: '2', name: 'L2 to L3 Auto', trigger: '75% resolution time exceeded', action: 'Escalate to L3', level: 3, isAutomatic: true },
    { id: '3', name: 'Admin Override', trigger: 'SLA breached', action: 'Notify Admin + Flag', level: 4, isAutomatic: false },
  ]);

  const [breachAlerts] = useState<BreachAlert[]>([
    { id: '1', ticketId: 'TKT-1234', type: 'warning', slaType: 'Response', timeRemaining: '5 min', assignedTo: 'John D.' },
    { id: '2', ticketId: 'TKT-1189', type: 'breach', slaType: 'Resolution', timeRemaining: '-15 min', assignedTo: 'Sarah M.' },
    { id: '3', ticketId: 'TKT-1201', type: 'warning', slaType: 'Response', timeRemaining: '12 min', assignedTo: 'Mike R.' },
  ]);

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

  const handleEscalate = useCallback(async (ticketId: string) => {
    await executeAction({
      actionId: `escalate_${ticketId}`,
      actionType: 'escalate',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { reason: 'SLA breach prevention' },
      successMessage: 'Ticket escalated successfully',
    });
  }, [executeAction]);

  const handleAdminOverride = useCallback(async (ticketId: string) => {
    await executeAction({
      actionId: `admin_override_${ticketId}`,
      actionType: 'approve',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: { action: 'admin_override' },
      successMessage: 'Admin override applied',
    });
    toast.success('Admin override applied');
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
