import { useMemo } from "react";
import { BarChart3, Download, FileText, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAgents, useLeads } from "@/lib/lead-manager/queries";
import { PIPELINE_STAGES } from "@/lib/lead-manager/types";
import { Panel, StatCard, exportLeadsCsv, inr } from "../shared";
import { printReport } from "./common";

export function ReportsScreen() {
  const { data: leads = [] } = useLeads();
  const { data: agents = [] } = useAgents();
  const source = useMemo(() => Object.entries(leads.reduce<Record<string, { total: number; won: number; value: number }>>((acc, lead) => { const row = acc[lead.source] ?? { total: 0, won: 0, value: 0 }; row.total++; if (lead.status === "won") { row.won++; row.value += lead.deal_value; } acc[lead.source] = row; return acc; }, {})).sort((a, b) => b[1].total - a[1].total), [leads]);
  const lost = useMemo(() => Object.entries(leads.filter((lead) => lead.status === "lost").reduce<Record<string, number>>((acc, lead) => { const reason = lead.lost_reason ?? "Not recorded"; acc[reason] = (acc[reason] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]), [leads]);
  const won = leads.filter((lead) => lead.status === "won");
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => exportLeadsCsv(leads, "lead-manager-report")}><Download className="size-4"/> CSV</Button><Button onClick={() => printReport("Lead Manager Report")}><FileText className="size-4"/> PDF</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total leads" value={String(leads.length)} icon={BarChart3}/><StatCard label="Won deals" value={String(won.length)} icon={TrendingUp} tone="success"/><StatCard label="Won revenue" value={inr(won.reduce((sum, lead) => sum + lead.deal_value, 0))} tone="success"/><StatCard label="Lost leads" value={String(leads.filter((lead) => lead.status === "lost").length)} icon={XCircle} tone="destructive"/></div>
    <div className="grid gap-4 xl:grid-cols-2"><Panel title="Source wise report" description="Volume, wins, conversion and realized revenue by acquisition source."><div className="space-y-3">{source.map(([name, row]) => <div key={name}><div className="flex justify-between text-sm"><span className="capitalize">{name}</span><span className="text-muted-foreground">{row.total} leads • {row.won} won • {inr(row.value)}</span></div><Progress value={leads.length ? row.total / leads.length * 100 : 0} className="mt-1 h-2"/></div>)}</div></Panel><Panel title="Agent wise performance" description="Live conversion and response KPIs from the team registry."><div className="space-y-2">{agents.map((agent) => <div key={agent.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2 p-3 text-sm"><span>{agent.name}<span className="block text-xs text-muted-foreground">{agent.team}</span></span><span className="text-right text-xs text-muted-foreground">{Number(agent.conversion_rate)}% conversion<br/>{agent.avg_response_minutes}m response</span></div>)}</div></Panel></div>
    <Panel title="Conversion funnel" description="Lead volume and deal value through every pipeline stage."><div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">{PIPELINE_STAGES.map((stage) => { const rows = leads.filter((lead) => lead.status === stage.id); return <div key={stage.id} className="stat-tile p-3"><p className="text-xs text-muted-foreground">{stage.label}</p><p className="mt-1 text-xl font-semibold">{rows.length}</p><p className="text-xs text-muted-foreground">{inr(rows.reduce((sum, lead) => sum + lead.deal_value, 0))}</p></div>; })}</div></Panel>
    <Panel title="Lost reason analysis" description="Reasons recorded when opportunities leave the pipeline."><div className="grid gap-2 md:grid-cols-2">{lost.map(([reason, count]) => <div key={reason} className="flex justify-between rounded-md border border-border bg-surface-2 p-3 text-sm"><span>{reason}</span><span>{count}</span></div>)}</div></Panel>
  </div>;
}