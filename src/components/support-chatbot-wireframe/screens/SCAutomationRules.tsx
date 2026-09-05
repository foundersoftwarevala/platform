/**
 * SCREEN 5: AUTOMATION RULES
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, ArrowRight, Clock, User, AlertTriangle, MoreHorizontal, Edit, Trash2, Play, Pause } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAutomationRules, useInsertRow, useUpdateRow, useDeleteRow, type AutomationRule } from '@/hooks/useSalesSupportData';

export const SCAutomationRules: React.FC = () => {
  const { data: rules, isLoading } = useAutomationRules();
  const insertRule = useInsertRow('automation_rules');
  const updateRule = useUpdateRow('automation_rules');
  const deleteRule = useDeleteRow('automation_rules');
  const [humanHandover, setHumanHandover] = useState(true);
  const [escalationLevel, setEscalationLevel] = useState('medium');

  const allRules = rules ?? [];

  const handleCreate = async () => {
    try {
      await insertRule.mutateAsync({ name: 'New Rule', trigger_event: 'custom', condition_text: '', action_text: 'Send message', is_enabled: false, scope: 'global', runs_count: 0 });
      toast.success('Rule created');
    } catch {
      toast.error('Failed to create rule');
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await updateRule.mutateAsync({ id: rule.id, values: { is_enabled: !rule.is_enabled } });
      toast.success('Rule updated');
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async (rule: AutomationRule) => {
    try {
      await deleteRule.mutateAsync(rule.id);
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure rules & triggers</p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Automation Rules</CardTitle>
              <CardDescription>Trigger → Condition → Action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading rules...</p>}
              {!isLoading && allRules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No automation rules yet.</p>
              )}
              {allRules.map((rule, index) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border ${rule.is_enabled ? 'bg-card' : 'bg-muted/30'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${rule.is_enabled ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                        <Zap className={`w-4 h-4 ${rule.is_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{rule.name}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{rule.trigger_event}</Badge>
                          <ArrowRight className="w-3 h-3" />
                          <span>{rule.condition_text ?? '—'}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>{rule.action_text}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.is_enabled} onCheckedChange={() => handleToggle(rule)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(rule)}>
                            {rule.is_enabled ? <><Pause className="w-4 h-4 mr-2" />Disable</> : <><Play className="w-4 h-4 mr-2" />Enable</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(rule)}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div className="space-y-4">
          {/* Human Handover */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Human Handover
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable handover</span>
                <Switch checked={humanHandover} onCheckedChange={setHumanHandover} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Escalation Level</label>
                <Select value={escalationLevel} onValueChange={setEscalationLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - After 3 failed responses</SelectItem>
                    <SelectItem value="medium">Medium - After 2 failed responses</SelectItem>
                    <SelectItem value="high">High - Immediate on request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Rule Scopes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Rules by Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from(new Set(allRules.map((r) => r.scope))).map((scope, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{scope}</span>
                  <span className="text-xs text-muted-foreground">
                    {allRules.filter((r) => r.scope === scope).length} rules
                  </span>
                </div>
              ))}
              {allRules.length === 0 && <p className="text-xs text-muted-foreground">No rules configured.</p>}
            </CardContent>
          </Card>

          {/* Escalation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Escalation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Timeout (minutes)</label>
                <Input type="number" defaultValue="5" className="h-9" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Max bot retries</label>
                <Input type="number" defaultValue="3" className="h-9" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
