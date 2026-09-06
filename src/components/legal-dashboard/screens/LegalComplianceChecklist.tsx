import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Database, Shield, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useUpdateRecordStatus, type LegalRecord } from "@/lib/legal-data";

const LegalComplianceChecklist = () => {
  const gdpr = useLegalRecords("compliance_gdpr");
  const kyc = useLegalRecords("compliance_kyc");
  const dp = useLegalRecords("compliance_dp");
  const updateRecord = useUpdateRecordStatus();

  const setStatus = (item: LegalRecord, category: string, status: "compliant" | "concern") =>
    updateRecord.mutate(
      {
        id: item.id,
        category,
        status,
        action: status === "compliant" ? "Compliance Reviewed" : "Compliance Concern Raised",
        details:
          status === "compliant"
            ? `${item.ref_code ?? item.name} marked as reviewed`
            : `Concern raised for ${item.ref_code ?? item.name}`,
      },
      {
        onSuccess: () =>
          status === "compliant"
            ? toast.success(`Item ${item.ref_code ?? item.name} marked as reviewed`)
            : toast.warning(`Concern raised for item ${item.ref_code ?? item.name}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );

  const section = (
    query: ReturnType<typeof useLegalRecords>,
    category: string,
    icon: React.ComponentType<{ className?: string }>,
    title: string,
  ) => (
    <CatalogueSection
      title={title}
      icon={icon}
      records={query.data ?? []}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error as { message?: string } | null}
      onRetry={() => void query.refetch()}
      emptyTitle="No checklist items"
      emptyDescription="Checklist items for this area will appear here."
      columns={[
        { key: "name", header: "Requirement" },
        { key: "lastReview", header: "Last review" },
        { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
      ]}
      rowActions={(item) => (
        <>
          {item.status !== "compliant" && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Mark ${item.name} reviewed`}
              disabled={updateRecord.isPending}
              onClick={() => setStatus(item, category, "compliant")}
            >
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </Button>
          )}
          {item.status !== "concern" && (
            <ConfirmButton
              size="sm"
              variant="ghost"
              title="Raise a compliance concern?"
              description={`${item.ref_code ?? item.name} will be flagged as a concern and logged in the audit trail.`}
              confirmLabel="Raise concern"
              aria-label={`Raise concern for ${item.name}`}
              disabled={updateRecord.isPending}
              onConfirm={() => setStatus(item, category, "concern")}
            >
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            </ConfirmButton>
          )}
        </>
      )}
    />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Compliance Checklist</h2>
      {section(gdpr, "compliance_gdpr", Shield, "GDPR / Local Law Status")}
      {section(kyc, "compliance_kyc", UserCheck, "KYC / AML Checks")}
      {section(dp, "compliance_dp", Database, "Data Protection Rules")}
    </motion.div>
  );
};

export default LegalComplianceChecklist;
