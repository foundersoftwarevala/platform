import { useState } from "react";
import { AlertCircle, Calendar, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEscalations, useFollowUps, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { Panel, StatCard, relTime } from "../shared";
import { useAction } from "./common";

export function EscalationsScreen() {
  const { data: escalations = [] } = useEscalations();
  const { data: followUps = [] } = useFollowUps();
  const { data: leads = [] } = useLeads();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const run = useAction();
  const names = new Map(leads.map((lead) => [lead.id, lead.name]));
  const pending = escalations.filter((item) => !item.is_resolved);
  const due = followUps.filter((item) => !item.is_completed);
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Pending escalations" value={String(pending.length)} icon={AlertCircle} tone="destructive"/><StatCard label="Open follow-ups" value={String(due.length)} icon={Calendar} tone="warning"/><StatCard label="Resolved escalations" value={String(escalations.length - pending.length)} icon={CheckCircle2} tone="success"/></div>
    <Panel title="Escalation queue" description="Resolve escalated leads with a mandatory resolution note."><div className="space-y-3">{pending.map((item) => <div key={item.id} className="rounded-md border border-border bg-surface-2 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-medium">{names.get(item.lead_id) ?? "Lead"}</p><p className="text-xs text-muted-foreground">Level {item.level} • {item.reason} • idle {item.idle_minutes ?? 0}m • {relTime(item.created_at)}</p></div><Badge variant="destructive">Escalated</Badge></div><div className="mt-3 flex gap-2"><Input value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution note"/><Button size="sm" disabled={!notes[item.id]?.trim()} onClick={() => run(() => leadApi.resolveEscalation(item.id, notes[item.id] ?? "Resolved"), "Escalation resolved")}>Resolve</Button></div></div>)}{pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending escalations.</p> : null}</div></Panel>
    <Panel title="Scheduled follow-ups" description="Upcoming calls, messages, emails and meetings."><div className="space-y-2">{due.slice(0, 30).map((item) => <div key={item.id} className="grid gap-3 rounded-md border border-border bg-surface-2 p-3 lg:grid-cols-[1fr_minmax(220px,1fr)_auto]"><div><p className="text-sm font-medium">{names.get(item.lead_id) ?? "Lead"}</p><p className="text-xs text-muted-foreground">{item.follow_up_type} • {relTime(item.scheduled_at)} • {item.notes ?? item.suggested_message ?? "No note"}</p></div><Input value={outcomes[item.id] ?? ""} onChange={(event) => setOutcomes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Outcome or next step"/><Button size="sm" variant="secondary" disabled={!outcomes[item.id]?.trim()} onClick={() => run(() => leadApi.completeFollowUp(item.id, outcomes[item.id] ?? "Completed"), "Follow-up completed")}>Complete</Button></div>)}</div></Panel>
  </div>;
}