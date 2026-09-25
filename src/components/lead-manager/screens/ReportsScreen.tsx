import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, FileText, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAgents, useCurrentAgent } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { PIPELINE_STAGES } from "@/lib/lead-manager/types";
import { Panel, StatCard, exportLeadsCsv, inr } from "../shared";
import { printReport } from "./common";

export function ReportsScreen() {
  const { data: agents = [] } = useAgents();
  const { data: agent } = useCurrentAgent();
  // Every figure below is counted by the database. Worked out in the browser
  // they would describe whatever page listLeads() happened to return, which
  // is the newest two hundred leads - a report that quietly shrinks as the
  // business grows.
  const { data: totals } = useQuery({
    queryKey: ["lm", "overview-stats"],
    queryFn: () => leadApi.leadOverviewStats(),
  });
  const { data: report } = useQuery({
    queryKey: ["lm", "report-stats"],
    queryFn: () => leadApi.leadReportStats(),
  });

  const source = report?.bySource ?? [];
  const lost = report?.byLostReason ?? [];
  const stageTotals = new Map((report?.byStage ?? []).map((r) => [r.status, r]));
  const totalLeads = totals?.total ?? 0;
  const lostLeads = stageTotals.get("lost")?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await leadApi.assertCanExport("the full lead report");
              const rows = await leadApi.fetchLeadsForExport();
              exportLeadsCsv(rows, "lead-manager-report", agent?.can_unmask ?? true);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Export failed");
            }
          }}
        >
          <Download className="size-4" /> CSV
        </Button>
        <Button onClick={() => printReport("Lead Manager Report")}>
          <FileText className="size-4" /> PDF
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={String(totalLeads)} icon={BarChart3} />
        <StatCard
          label="Won deals"
          value={String(totals?.won ?? 0)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard label="Won revenue" value={inr(totals?.wonValue ?? 0)} tone="success" />
        <StatCard label="Lost leads" value={String(lostLeads)} icon={XCircle} tone="destructive" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Source wise report"
          description="Volume, wins, conversion and realized revenue by acquisition source."
        >
          <div className="space-y-3">
            {source.map((row) => (
              <div key={row.source}>
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{row.source}</span>
                  <span className="text-muted-foreground">
                    {row.total} leads • {row.won} won • {inr(row.value)}
                  </span>
                </div>
                <Progress
                  value={totalLeads ? (row.total / totalLeads) * 100 : 0}
                  className="mt-1 h-2"
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Agent wise performance"
          description="Live conversion and response KPIs from the team registry."
        >
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface-2 p-3 text-sm"
              >
                <span>
                  {agent.name}
                  <span className="block text-xs text-muted-foreground">{agent.team}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {Number(agent.conversion_rate)}% conversion
                  <br />
                  {agent.avg_response_minutes}m response
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Conversion funnel"
        description="Lead volume and deal value through every pipeline stage."
      >
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {PIPELINE_STAGES.map((stage) => {
            const row = stageTotals.get(stage.id);
            return (
              <div key={stage.id} className="stat-tile p-3">
                <p className="text-xs text-muted-foreground">{stage.label}</p>
                <p className="mt-1 text-xl font-semibold">{row?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">{inr(row?.value ?? 0)}</p>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel
        title="Lost reason analysis"
        description="Reasons recorded when opportunities leave the pipeline."
      >
        <div className="grid gap-2 md:grid-cols-2">
          {lost.map(({ reason, total }) => (
            <div
              key={reason}
              className="flex justify-between rounded-md border border-border bg-surface-2 p-3 text-sm"
            >
              <span>{reason}</span>
              <span>{total}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
