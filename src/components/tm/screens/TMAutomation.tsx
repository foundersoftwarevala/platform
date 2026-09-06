import { useState } from "react";
import { Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, titleCase } from "@/lib/tm/format";
import { useAutomations, useCreateAutomation, useToggleAutomation } from "@/lib/tm/hooks";
import { TMEmpty, TMLoading, TMPageHeader, TMPanel, TMRow } from "../shared";

const TRIGGERS = [
  "task_created",
  "status_changed",
  "sla_at_risk",
  "sla_breached",
  "unassigned_timeout",
  "approval_pending",
  "task_completed",
  "daily_digest",
];
const ACTIONS = ["assign", "notify", "escalate", "set_priority", "add_tag", "buzzer", "ai_review"];

export function TMAutomation() {
  const { data: automations, isLoading } = useAutomations();
  const toggle = useToggleAutomation();
  const create = useCreateAutomation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState(TRIGGERS[0]!);
  const [action, setAction] = useState(ACTIONS[0]!);
  const [enabled, setEnabled] = useState(true);

  if (isLoading) return <TMLoading label="Loading automation rules" />;

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Automation"
        subtitle="Trigger → action rules for assignment, notification and escalation"
        actions={<Badge variant="outline">{(automations ?? []).filter((a) => a.enabled).length} enabled</Badge>}
      />

      <TMPanel title="Create rule" icon={<Zap className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Rule name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Escalate critical SLA breach" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{titleCase(a)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Enabled</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() => {
                create.mutate({ name: name.trim(), description: description.trim(), trigger_type: trigger, action_type: action, enabled });
                setName("");
                setDescription("");
              }}
            >
              Create rule
            </Button>
          </div>
        </div>
      </TMPanel>

      <TMPanel title="Rules">
        <div className="space-y-3">
          {(automations ?? []).map((rule) => (
            <TMRow key={rule.id}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{rule.name}</p>
                <p className="text-xs text-muted-foreground">{rule.description}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(rule.trigger_type)} → {titleCase(rule.action_type)} • ran {rule.run_count}× • last {formatDateTime(rule.last_run_at)}
                </p>
              </div>
              <Switch checked={rule.enabled} onCheckedChange={() => toggle.mutate(rule)} />
            </TMRow>
          ))}
          {(automations ?? []).length === 0 && <TMEmpty message="No automation rules" />}
        </div>
      </TMPanel>
    </div>
  );
}
