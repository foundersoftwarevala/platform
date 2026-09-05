import { Plug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useIntegrationEvents, useIntegrations } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { Panel, StatCard, relTime } from "../shared";
import { useAction } from "./common";

export function IntegrationsScreen() {
  const { data: integrations = [] } = useIntegrations();
  const { data: events = [] } = useIntegrationEvents();
  const run = useAction();
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Connected" value={String(integrations.filter((item) => item.is_enabled).length)} icon={Plug} tone="success"/><StatCard label="Events today" value={String(integrations.reduce((sum, item) => sum + item.events_today, 0))} tone="info"/><StatCard label="Available connectors" value={String(integrations.length)}/></div><Panel title="Lead integrations" description="Live connector registry for CRM, WhatsApp, email, calling and website forms."><div className="grid gap-3 md:grid-cols-2">{integrations.map((item) => <div key={item.id} className="rounded-md border border-border bg-surface-2 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.description}</p></div><Switch checked={item.is_enabled} onCheckedChange={(checked) => run(() => leadApi.toggleIntegration(item.integration_key, checked), `${item.name} ${checked ? "connected" : "disconnected"}`)}/></div><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{item.status}</Badge><span className="text-xs text-muted-foreground">{item.events_today} events today • last sync {relTime(item.last_sync_at)}</span><Button size="sm" variant="ghost" disabled={!item.is_enabled} onClick={() => run(() => leadApi.syncIntegration(item.integration_key, item.name), `${item.name} synced`)}><RefreshCw className="size-4"/> Sync</Button></div></div>)}</div></Panel><Panel title="Recent sync activity" description="Events reported by connected lead services."><div className="space-y-2">{events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-border bg-surface-2 p-3 text-sm"><span>{event.detail}</span><span className="text-xs text-muted-foreground">{event.integration_key} • {event.status} • {relTime(event.created_at)}</span></div>)}</div></Panel></div>;
}