import { motion } from "framer-motion";
import { AlertTriangle, FileText, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useLogAction, useUpdateRecordStatus } from "@/lib/legal-data";

const severityBadge = (severity: string) => {
  const tone =
    severity === "critical"
      ? "bg-red-500/20 text-red-400"
      : severity === "high"
        ? "bg-orange-500/20 text-orange-400"
        : severity === "medium"
          ? "bg-yellow-500/20 text-yellow-400"
          : severity === "low"
            ? "bg-blue-500/20 text-blue-400"
            : "bg-muted/20 text-muted-foreground";
  return <Badge className={tone}>{severity || "unknown"}</Badge>;
};

const LegalIncidentsDisputes = () => {
  const { data: incidents = [], isLoading, isError, error, refetch } = useLegalRecords("incident");
  const logAction = useLogAction();
  const updateRecord = useUpdateRecordStatus();

  const setStatus = (id: string, ref: string, status: string, action: string, details: string, done: () => void) =>
    updateRecord.mutate(
      { id, category: "incident", status, action, details },
      { onSuccess: done, onError: (mutationError) => toast.error(mutationError.message) },
    );

  const handleRecommendAction = (ref: string) =>
    logAction.mutate(
      {
        action: "Incident Action Recommended",
        category: "incident",
        actor: "LM-A1B2",
        details: `Action recommendation submitted for case ${ref}`,
      },
      {
        onSuccess: () => toast.success(`Action recommendation submitted for case ${ref}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );

  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const investigatingCount = incidents.filter((i) => i.status === "investigating").length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Incidents &amp; Disputes</h2>
        <div className="flex gap-2">
          <Badge className="bg-red-500/20 text-red-400">{criticalCount} Critical</Badge>
          <Badge className="bg-blue-500/20 text-blue-400">{investigatingCount} Investigating</Badge>
        </div>
      </div>

      <CatalogueSection
        title="All Cases"
        icon={AlertTriangle}
        records={incidents}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="No open cases"
        emptyDescription="Incidents and disputes will appear here as they are raised."
        columns={[
          { key: "ref_code", header: "Case ID", className: "font-mono text-primary" },
          { key: "type", header: "Type", render: (r) => String(r.type || r.name) },
          { key: "parties", header: "Parties" },
          { key: "severity", header: "Severity", render: (r) => severityBadge(String(r.severity ?? "")) },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(incident) => {
          const ref = incident.ref_code ?? incident.name;
          return (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Investigate case ${ref}`}
                disabled={updateRecord.isPending}
                onClick={() =>
                  setStatus(incident.id, ref, "investigating", "Incident Investigation Started", `Investigation started for case ${ref}`, () =>
                    toast.info(`Investigation started for case ${ref}`),
                  )
                }
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Recommend action for case ${ref}`}
                disabled={logAction.isPending}
                onClick={() => handleRecommendAction(ref)}
              >
                <FileText className="h-4 w-4 text-emerald-400" />
              </Button>
              <ConfirmButton
                size="sm"
                variant="ghost"
                title="Escalate to Super Admin?"
                description={`Case ${ref} is escalated and the action is written to the audit trail.`}
                confirmLabel="Escalate"
                aria-label={`Escalate case ${ref}`}
                disabled={updateRecord.isPending}
                onConfirm={() =>
                  setStatus(incident.id, ref, "escalated", "Incident Escalated", `Case ${ref} escalated to Super Admin`, () =>
                    toast.warning(`Case ${ref} escalated to Super Admin`),
                  )
                }
              >
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              </ConfirmButton>
            </>
          );
        }}
      />
    </motion.div>
  );
};

export default LegalIncidentsDisputes;
