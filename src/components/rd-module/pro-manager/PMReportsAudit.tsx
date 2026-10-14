import { useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/rd-module/ui/select";
import { usePMAuditLogs, usePMReports } from "@/hooks/rd-module/useProManagerData";
import { downloadCsv, useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, StatusBadge, formatDate } from "./pm-ui";

type ReportType = "daily" | "weekly" | "monthly" | "custom";

export const PMReportsAudit = () => {
  const { data: reports, isLoading } = usePMReports();
  const { data: logs } = usePMAuditLogs();
  const { generateReport, exportAuditTrail, run } = useProManagerActions();
  const [name, setName] = useState("Pro Manager Governance Report");
  const [type, setType] = useState<ReportType>("weekly");

  return (
    <PMPanel
      title="Reports & audit exports"
      description="Generated reports and immutable audit trail exports"
      icon={FileBarChart}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-64"
          aria-label="Report name"
        />
        <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => void run("Report generated", generateReport({ data: { name, type } }))}
        >
          Generate report
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const result = await run(
              "Audit trail exported",
              exportAuditTrail({ data: { limit: 200 } }),
            );
            if (result) downloadCsv(`pro-manager-audit-${Date.now()}.csv`, result.csv);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export audit CSV
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Generated reports
          </p>
          {isLoading ? (
            <PMLoading rows={2} />
          ) : (reports ?? []).length === 0 ? (
            <PMEmpty message="No reports generated yet." />
          ) : (
            <ul className="space-y-2">
              {(reports ?? []).slice(0, 8).map((report) => (
                <li
                  key={report.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="text-foreground">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.code} • {report.type} • {report.size} •{" "}
                      {formatDate(report.generated_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Latest audit entries
          </p>
          {(logs ?? []).length === 0 ? (
            <PMEmpty message="Audit trail is empty." />
          ) : (
            <ul className="space-y-2">
              {(logs ?? []).slice(0, 8).map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-foreground">{log.action}</p>
                    <StatusBadge value={log.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {log.actor} → {log.target} • {formatDate(log.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PMPanel>
  );
};
