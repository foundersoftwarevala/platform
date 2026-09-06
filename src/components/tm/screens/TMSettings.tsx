import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSaveSettings, useSettings } from "@/lib/tm/hooks";
import type { TMSettings as TMSettingsRow } from "@/lib/tm/types";
import { TMLoading, TMPageHeader, TMPanel } from "../shared";

export function TMSettings() {
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<TMSettingsRow | null>(null);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (isLoading || !draft) return <TMLoading label="Loading settings" />;

  const set = <K extends keyof TMSettingsRow>(key: K, value: TMSettingsRow[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-6">
      <TMPageHeader
        title="Task Settings"
        subtitle="SLA windows, automation defaults and working hours"
        actions={
          <Button onClick={() => save.mutate({ id: draft.id, patch: draft })} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TMPanel title="SLA" icon={<Settings className="h-4 w-4" />}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Default SLA hours</Label>
              <Input type="number" value={draft.default_sla_hours} onChange={(e) => set("default_sla_hours", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Critical SLA hours</Label>
              <Input type="number" value={draft.critical_sla_hours} onChange={(e) => set("critical_sla_hours", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>SLA warning threshold (%)</Label>
              <Input type="number" value={draft.sla_warning_percent} onChange={(e) => set("sla_warning_percent", Number(e.target.value))} />
            </div>
          </div>
        </TMPanel>

        <TMPanel title="Automation & alerts">
          <div className="space-y-4">
            {([
              ["auto_assign", "Auto-assign new tasks"],
              ["auto_escalate", "Auto-escalate SLA breaches"],
              ["buzzer_enabled", "Buzzer alerts"],
              ["require_approval", "Require approval before closure"],
              ["ai_review_enabled", "AI review stage"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={draft[key]} onCheckedChange={(v) => set(key, v)} />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Buzzer repeat (minutes)</Label>
              <Input type="number" value={draft.buzzer_repeat_minutes} onChange={(e) => set("buzzer_repeat_minutes", Number(e.target.value))} />
            </div>
          </div>
        </TMPanel>

        <TMPanel title="Working hours">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input value={draft.working_hours_start} onChange={(e) => set("working_hours_start", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input value={draft.working_hours_end} onChange={(e) => set("working_hours_end", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} />
            </div>
          </div>
        </TMPanel>
      </div>
    </div>
  );
}
