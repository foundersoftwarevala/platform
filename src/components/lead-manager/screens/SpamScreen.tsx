import { useMemo, useState } from "react";
import { RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgents, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, StatCard } from "../shared";
import { useAction } from "./common";

export function SpamScreen({ onSelect }: { onSelect: (lead: Lead) => void }) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const [filter, setFilter] = useState("all");
  const run = useAction();
  const spam = leads.filter((lead) => lead.status === "spam");
  const rows = useMemo(() => filter === "all" ? spam : spam.filter((lead) => (lead.spam_reason ?? "").toLowerCase().includes(filter)), [spam, filter]);
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Spam / rejected" value={String(spam.length)} icon={ShieldAlert} tone="destructive"/><StatCard label="Duplicates" value={String(spam.filter((lead) => (lead.spam_reason ?? "").toLowerCase().includes("duplicate")).length)} tone="warning"/><StatCard label="High fraud score" value={String(spam.filter((lead) => lead.fraud_score >= 70).length)} tone="destructive"/></div><Panel title="Fraud filter review" description="Review rejected records, restore valid leads, or permanently remove confirmed junk." actions={<Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All reasons</SelectItem><SelectItem value="duplicate">Duplicate</SelectItem><SelectItem value="spam">Spam</SelectItem><SelectItem value="bot">Bot</SelectItem></SelectContent></Select>}><div className="space-y-2">{rows.map((lead) => <div key={lead.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3"><button className="min-w-48 flex-1 text-left" onClick={() => onSelect(lead)}><p className="text-sm font-medium">{lead.name}</p><p className="text-xs text-muted-foreground">{lead.email} • {lead.spam_reason ?? "Rejected by fraud filter"} • fraud {lead.fraud_score}%</p></button><Button size="sm" variant="secondary" onClick={() => run(() => leadApi.changeStatus(lead.id, "new"), "Lead restored") }><RotateCcw className="size-4"/> Restore</Button><Button size="sm" variant="destructive" onClick={() => run(() => leadApi.deleteLead(lead.id, lead.name), "Lead deleted") }><Trash2 className="size-4"/> Delete</Button></div>)}</div><div className="mt-4"><LeadTable leads={rows} agents={agents} isLoading={isLoading} onSelect={onSelect} columns={["contact", "source", "priority", "score", "created"]}/></div></Panel></div>;
}