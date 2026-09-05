/**
 * AUTOMATION RULES SCREEN
 * Configure auto-reply and escalation
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Zap,
  MessageSquare,
  ArrowRight,
  Clock,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAutomationRules, useUpdateRow, useInsertRow, relativeTime } from '@/hooks/useSalesSupportData';

export const CBAutomationRules: React.FC = () => {
  const { data: rules, isLoading } = useAutomationRules();
  const updateRule = useUpdateRow('automation_rules');
  const insertRule = useInsertRow('automation_rules');

  const toggleRule = (id: string, enabled: boolean) => {
    updateRule.mutate(
      { id, values: { is_enabled: !enabled } },
      {
        onSuccess: () => toast({ title: 'Rule updated' }),
        onError: (e) => toast({ title: 'Update failed', description: String(e), variant: 'destructive' }),
      },
    );
  };

  const handleCreate = () => {
    insertRule.mutate(
      {
        name: 'New Rule',
        trigger_event: 'New conversation starts',
        action_text: 'Send greeting message',
        is_enabled: true,
      },
      {
        onSuccess: () => toast({ title: 'Rule created' }),
        onError: (e) => toast({ title: 'Create failed', description: String(e), variant: 'destructive' }),
      },
    );
  };

  const rulesList = rules ?? [];
  const urgentRule = rulesList.find((r) => /urgent/i.test(r.trigger_event) || /urgent/i.test(r.action_text));
  const escalationRules = [
    { priority: 'Urgent', color: 'red', action: urgentRule?.action_text ?? 'Notify all agents immediately', time: '< 1 min' },
    { priority: 'High', color: 'orange', action: 'Notify available agent', time: '< 5 min' },
    { priority: 'Normal', color: 'blue', action: 'Add to queue', time: '< 15 min' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automation Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up automatic responses and triggers</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto-Reply Rules */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Auto-Reply Rules
            </CardTitle>
            <CardDescription>Automatic responses based on triggers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading rules…</p>
            ) : rulesList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No automation rules yet.</p>
            ) : (
              rulesList.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border ${
                    rule.is_enabled ? 'bg-card border-border' : 'bg-surface border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground">{rule.name}</span>
                        {rule.is_enabled && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Active</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {rule.runs_count} runs • last {relativeTime(rule.last_run_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                          When: {rule.trigger_event}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                          Then: {rule.action_text}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      checked={rule.is_enabled}
                      onCheckedChange={() => toggleRule(rule.id, rule.is_enabled)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Human Handover */}
        <Card className="bg-card border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-blue-600" />
              Human Handover
            </CardTitle>
            <CardDescription>When should bot transfer to human?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Auto Handover</p>
                  <p className="text-xs text-muted-foreground">Transfer when bot can't help</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {rulesList.filter((r) => r.is_enabled).length} rules active
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Active rules:</p>
              <div className="space-y-2">
                {rulesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rules configured.</p>
                ) : (
                  rulesList.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-3 text-sm">
                      <Switch checked={rule.is_enabled} className="scale-75" disabled />
                      <span className="text-muted-foreground">{rule.name}: {rule.condition_text ?? rule.trigger_event}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escalation Logic */}
        <Card className="bg-card border-border shadow-sm rounded-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Escalation Logic
            </CardTitle>
            <CardDescription>Priority-based routing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {escalationRules.map((level, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={`bg-${level.color}-100 text-${level.color}-700 text-xs`}>
                      {level.priority}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{level.action}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {level.time}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
