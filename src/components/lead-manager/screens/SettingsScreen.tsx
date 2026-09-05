import { Bell, Calendar, GitBranch, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSettings } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { Panel, StatCard } from "../shared";
import { useAction } from "./common";

const ICONS = { status: Settings, assignment: GitBranch, notification: Bell, hours: Calendar, expiry: Calendar };
export function SettingsScreen() {
  const { data: settings = [] } = useSettings();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const run = useAction();
  const categories = [...new Set(settings.map((item) => item.category))];
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Configuration items" value={String(settings.length)} icon={Settings}/><StatCard label="Enabled rules" value={String(settings.filter((item) => item.value_bool === true).length)} tone="success"/><StatCard label="Settings groups" value={String(categories.length)} tone="info"/></div><div className="grid gap-4 xl:grid-cols-2">{categories.map((category) => { const Icon = ICONS[category as keyof typeof ICONS] ?? Settings; return <Panel key={category} title={category.replace(/_/g, " ")} description="Changes apply immediately to the Lead Manager configuration."><div className="space-y-3">{settings.filter((item) => item.category === category).map((item) => <div key={item.id} className="rounded-md border border-border bg-surface-2 p-3"><div className="flex items-center gap-2"><Icon className="size-4 text-primary"/><span className="flex-1 text-sm">{item.label}</span>{item.value_bool !== null ? <Switch checked={item.value_bool} onCheckedChange={(checked) => run(() => leadApi.toggleSetting(item.setting_key, checked), `${item.label} updated`)}/> : null}</div>{item.value_text !== null ? <div className="mt-3 flex gap-2"><Input value={drafts[item.setting_key] ?? item.value_text} onChange={(event) => setDrafts((current) => ({ ...current, [item.setting_key]: event.target.value }))}/><Button size="sm" disabled={(drafts[item.setting_key] ?? item.value_text) === item.value_text} onClick={() => run(() => leadApi.updateSettingText(item.setting_key, drafts[item.setting_key] ?? item.value_text ?? ""), `${item.label} saved`)}>Save</Button></div> : null}</div>)}</div></Panel>; })}</div></div>;
}