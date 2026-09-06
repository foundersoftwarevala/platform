import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { useLegalLogs, type LegalRecord } from "@/lib/legal-data";

const RESULT_BY_ACTION: Record<string, string> = {
  "Policy Updated": "Approved",
  "Policy Status Changed": "Approved",
  "Policy Update Proposed": "Pending Approval",
  "Contract Reviewed": "Flagged Risk",
  "Contract Risk Flagged": "Flagged Risk",
  "Trademark Record Requested": "Pending Approval",
  "Trademark Renewal Requested": "Pending Approval",
  "Incident Escalated": "Escalated",
  "Alert Escalated": "Escalated",
  "Violation Escalated": "Escalated",
  "Compliance Reviewed": "Compliant",
  "Legal Request Resolved": "Resolved",
  "Approval Given": "Approved",
  "Approval Rejected": "Rejected",
};

const resultColor = (result: string) => {
  switch (result) {
    case "Approved":
    case "Compliant":
    case "Resolved":
      return "text-emerald-400";
    case "Pending Approval":
      return "text-yellow-400";
    case "Rejected":
    case "Flagged Risk":
      return "text-red-400";
    case "Escalated":
      return "text-purple-400";
    default:
      return "text-muted-foreground";
  }
};

const LegalAudit = () => {
  const { data: logs = [], isLoading, isError, error, refetch } = useLegalLogs();

  const records = useMemo<LegalRecord[]>(
    () =>
      logs.map((log, index) => {
        const result = RESULT_BY_ACTION[log.action] ?? "Logged";
        return {
          id: log.id,
          ref_code: log.ref_code ?? null,
          name: log.action,
          type: String(log.category ?? "audit"),
          status: result,
          position: index,
          actor: log.actor,
          time: new Date(log.logged_at).toLocaleString("sv-SE").replace("T", " "),
          approvalRef:
            result === "Approved" || result === "Pending Approval" || result === "Escalated"
              ? (log.ref_code ?? "N/A")
              : "N/A",
          details: log.details,
        } as LegalRecord;
      }),
    [logs],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-foreground">Audit Trail</h2>
        </div>
        <Badge className="bg-muted text-foreground">Read Only</Badge>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        <p className="text-sm text-yellow-400">
          This is an immutable audit log. No modifications or exports are permitted.
        </p>
      </div>

      <CatalogueSection
        title="Activity Log"
        icon={Shield}
        records={records}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        pageSize={12}
        emptyTitle="No audit entries"
        emptyDescription="Every action taken in the workspace is recorded here."
        columns={[
          { key: "time", header: "Time", className: "font-mono text-sm" },
          { key: "name", header: "Action" },
          { key: "actor", header: "Actor", className: "font-mono text-sm" },
          {
            key: "status",
            header: "Result",
            render: (r) => <span className={resultColor(String(r.status))}>{String(r.status)}</span>,
          },
          {
            key: "approvalRef",
            header: "Approval Reference",
            render: (r) => (
              <span
                className={
                  r.approvalRef === "N/A" ? "text-muted-foreground" : "font-mono text-sm text-primary"
                }
              >
                {String(r.approvalRef)}
              </span>
            ),
          },
        ]}
      />
    </motion.div>
  );
};

export default LegalAudit;
