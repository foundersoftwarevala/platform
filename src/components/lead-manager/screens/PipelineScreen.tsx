import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgents, useLeads } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { STAGE_SECTIONS } from "@/lib/lead-manager/nav";
import { PIPELINE_STAGES, type Lead, type LeadStatus } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, StatCard, inr, num, relTime } from "../shared";
import { useAction } from "./common";

export function PipelineScreen({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (lead: Lead) => void;
}) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const run = useAction();

  const stage = STAGE_SECTIONS[section] as LeadStatus | undefined;
  const rows = useMemo(() => (stage ? leads.filter((l) => l.status === stage) : leads), [leads, stage]);

  const byStage = (id: LeadStatus) => leads.filter((l) => l.status === id);
  const stageValue = (id: LeadStatus) => byStage(id).reduce((a, l) => a + (l.deal_value ?? 0), 0);
  const nextStage = (current: LeadStatus): LeadStatus | null => {
    const order: LeadStatus[] = ["new", "contacted", "interested", "follow_up", "negotiation", "won"];
    const i = order.indexOf(current);
    return i >= 0 && i < order.length - 1 ? (order[i + 1] as LeadStatus) : null;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads in pipeline" value={num(leads.filter((l) => !["won", "lost", "spam"].includes(l.status)).length)} />
        <StatCard label="Negotiation value" value={inr(stageValue("negotiation"))} tone="warning" />
        <StatCard label="Won value" value={inr(stageValue("won"))} tone="success" />
        <StatCard label="Lost" value={num(byStage("lost").length)} tone="destructive" />
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {PIPELINE_STAGES.map((s) => {
          const items = byStage(s.id);
          return (
            <div
              key={s.id}
              className={`rounded-lg border p-3 ${stage === s.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{inr(stageValue(s.id))}</p>
              <div className="mt-3 space-y-2">
                {items.slice(0, 4).map((l) => (
                  <div key={l.id} className="rounded-md border border-border bg-surface-2 p-2">
                    <button className="w-full text-left" onClick={() => onSelect(l)}>
                      <p className="truncate text-xs font-medium">{l.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {l.company ?? l.sub_source}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{relTime(l.created_at)}</p>
                    </button>
                    {nextStage(l.status as LeadStatus) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-6 w-full px-1 text-[11px]"
                        onClick={() =>
                          run(
                            () => leadApi.changeStatus(l.id, nextStage(l.status as LeadStatus) as LeadStatus),
                            `${l.name} advanced`,
                          )
                        }
                      >
                        Advance →
                      </Button>
                    ) : null}
                  </div>
                ))}
                {items.length > 4 ? (
                  <p className="text-[11px] text-muted-foreground">+{items.length - 4} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Panel
        title={`${stage ? PIPELINE_STAGES.find((s) => s.id === stage)?.label : "All stages"} — ${rows.length} leads`}
        description="Open any lead to move it through the pipeline, log outreach or convert it."
      >
        <LeadTable
          leads={rows}
          agents={agents}
          isLoading={isLoading}
          onSelect={onSelect}
          columns={["source", "status", "priority", "agent", "score", "value", "followup"]}
        />
      </Panel>
    </div>
  );
}
