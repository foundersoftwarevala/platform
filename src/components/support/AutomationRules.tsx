import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, Plus, Play, Pause, Trash2, Copy, Edit, CheckCircle,
  AlertTriangle, Clock, User, Tag, MessageCircle, ArrowRight, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnterpriseAudit } from '@/hooks/useEnterpriseAudit';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; target: string; value?: string }[];
  triggerCount: number;
  lastTriggered: string;
  createdBy: string;
}

const rules: AutomationRule[] = [
  {
    id: 'AR001',
    name: 'High Priority Auto-Assignment',
    description: 'Automatically assign high priority tickets to senior agents',
    isActive: true,
    conditions: [
      { field: 'priority', operator: 'equals', value: 'high' },
      { field: 'category', operator: 'equals', value: 'Payment' },
    ],
    actions: [
      { type: 'assign', target: 'agent_pool', value: 'senior' },
      { type: 'set_sla', target: 'response_time', value: '15m' },
      { type: 'notify', target: 'manager', value: 'email' },
    ],
    triggerCount: 234,
    lastTriggered: '5 min ago',
    createdBy: 'System Admin',
  },
  {
    id: 'AR002',
    name: 'Negative Sentiment Escalation',
    description: 'Escalate tickets with negative sentiment to supervisors',
    isActive: true,
    conditions: [
      { field: 'sentiment', operator: 'equals', value: 'negative' },
      { field: 'reopen_count', operator: 'greater_than', value: '2' },
    ],
    actions: [
      { type: 'escalate', target: 'level', value: 'L2' },
      { type: 'add_tag', target: 'ticket', value: 'needs-attention' },
      { type: 'send_ai_reply', target: 'customer' },
    ],
    triggerCount: 89,
    lastTriggered: '1 hour ago',
    createdBy: 'Support Manager',
  },
  {
    id: 'AR003',
    name: 'Auto-Close Resolved',
    description: 'Close tickets after 48 hours of no customer response',
    isActive: false,
    conditions: [
      { field: 'status', operator: 'equals', value: 'waiting_customer' },
      { field: 'last_response', operator: 'older_than', value: '48h' },
    ],
    actions: [
      { type: 'update_status', target: 'ticket', value: 'closed' },
      { type: 'send_survey', target: 'customer' },
    ],
    triggerCount: 156,
    lastTriggered: '2 hours ago',
    createdBy: 'System Admin',
  },
  {
    id: 'AR004',
    name: 'VIP Customer Priority Boost',
    description: 'Boost priority for VIP customer tickets',
    isActive: true,
    conditions: [
      { field: 'customer_tier', operator: 'equals', value: 'VIP' },
    ],
    actions: [
      { type: 'set_priority', target: 'ticket', value: 'high' },
      { type: 'assign', target: 'agent_pool', value: 'dedicated' },
      { type: 'set_sla', target: 'response_time', value: '5m' },
    ],
    triggerCount: 67,
    lastTriggered: '30 min ago',
    createdBy: 'Country Head',
  },
];

const AutomationRules = () => {
  const { logAction } = useEnterpriseAudit();
  const [rulesList, setRulesList] = useState(rules);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  const handleToggleRule = useCallback(async (ruleId: string) => {
    const rule = rulesList.find(r => r.id === ruleId);
    if (!rule) return;
    setRulesList(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: !r.isActive } : r));
    await logAction({ action: 'toggle_rule', module: 'ai_system', severity: 'medium', target_id: ruleId, new_values: { isActive: !rule.isActive } });
    toast.success(`Rule ${!rule.isActive ? 'enabled' : 'disabled'}`);
  }, [rulesList, logAction]);

  const handleDuplicateRule = useCallback(async (ruleId: string) => {
    const rule = rulesList.find(r => r.id === ruleId);
    if (!rule) return;
    const newRule = { ...rule, id: `AR${Date.now()}`, name: `${rule.name} (Copy)`, triggerCount: 0 };
    setRulesList(prev => [...prev, newRule]);
    await logAction({ action: 'duplicate_rule', module: 'ai_system', severity: 'low', target_id: newRule.id });
    toast.success('Rule duplicated');
  }, [rulesList, logAction]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    setRulesList(prev => prev.filter(r => r.id !== ruleId));
    await logAction({ action: 'delete_rule', module: 'ai_system', severity: 'high', target_id: ruleId });
    toast.success('Rule deleted');
  }, [logAction]);

  const handleTestRule = useCallback(async (ruleId: string) => {
    await logAction({ action: 'test_rule', module: 'ai_system', severity: 'low', target_id: ruleId });
    toast.success('Test completed - rule would match 3 tickets');
  }, [logAction]);

  const getConditionIcon = (field: string) => {
    switch (field) {
      case 'priority': return AlertTriangle;
      case 'sentiment': return MessageCircle;
      case 'status': return CheckCircle;
      case 'customer_tier': return User;
      default: return Tag;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'assign': return 'bg-blue-500/20 text-blue-400';
      case 'escalate': return 'bg-red-500/20 text-red-400';
      case 'set_sla': return 'bg-amber-500/20 text-amber-400';
      case 'notify': return 'bg-purple-500/20 text-purple-400';
      case 'send_ai_reply': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-muted/40 text-muted-foreground';
    }
  };

  const stats = {
    total: rulesList.length,
    active: rulesList.filter(r => r.isActive).length,
    triggered: rulesList.reduce((acc, r) => acc + r.triggerCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Automation Rules
          </h2>
          <p className="text-muted-foreground text-sm">Configure IF-THEN automation for ticket handling</p>
        </div>
        <Button className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30">
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Rules</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <Play className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{stats.triggered}</div>
            <div className="text-xs text-muted-foreground">Times Triggered</div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rulesList.map((rule, index) => {
          const isSelected = selectedRule === rule.id;

          return (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`bg-card/60 transition-all ${
                rule.isActive ? 'border-amber-500/20' : 'border-border opacity-70'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={rule.isActive} 
                        onCheckedChange={() => handleToggleRule(rule.id)}
                      />
                      <div>
                        <h4 className="font-medium text-foreground">{rule.name}</h4>
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-400">{rule.triggerCount}</div>
                        <div className="text-xs text-muted-foreground">Triggered</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last: {rule.lastTriggered}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setSelectedRule(isSelected ? null : rule.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleTestRule(rule.id)}
                          className="text-teal-400 hover:bg-teal-500/20"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDuplicateRule(rule.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Conditions & Actions Preview */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">IF:</p>
                      <div className="flex flex-wrap gap-2">
                        {rule.conditions.map((cond, idx) => {
                          const Icon = getConditionIcon(cond.field);
                          return (
                            <Badge key={idx} variant="outline" className="text-muted-foreground border-border">
                              <Icon className="w-3 h-3 mr-1" />
                              {cond.field} {cond.operator} {cond.value}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-amber-400" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">THEN:</p>
                      <div className="flex flex-wrap gap-2">
                        {rule.actions.map((action, idx) => (
                          <Badge key={idx} className={getActionColor(action.type)}>
                            {action.type}: {action.value || action.target}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expanded View */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-border"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-card/60">
                          <p className="text-xs text-muted-foreground mb-2">Conditions (IF)</p>
                          <div className="space-y-2">
                            {rule.conditions.map((cond, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                                <span className="text-teal-400">{cond.field}</span>
                                <span className="text-muted-foreground">{cond.operator}</span>
                                <span className="text-amber-400">"{cond.value}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-card/60">
                          <p className="text-xs text-muted-foreground mb-2">Actions (THEN)</p>
                          <div className="space-y-2">
                            {rule.actions.map((action, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                                <Badge className={getActionColor(action.type)}>{action.type}</Badge>
                                <span className="text-muted-foreground">{action.target}</span>
                                {action.value && <span className="text-teal-400">= {action.value}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Created by: {rule.createdBy}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AutomationRules;
