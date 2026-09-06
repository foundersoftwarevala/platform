import { motion } from "framer-motion";
import { Edit, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useUpdateRecordStatus, useLogAction } from "@/lib/legal-data";

const LegalPoliciesTerms = () => {
  const { data: policies = [], isLoading, isError, error, refetch } = useLegalRecords("policy");
  const updateRecord = useUpdateRecordStatus();
  const logAction = useLogAction();

  const handleProposeUpdate = (id: string, name: string) => {
    updateRecord.mutate(
      {
        id,
        category: "policy",
        status: "review",
        action: "Policy Update Proposed",
        details: `Update proposal submitted for "${name}"`,
      },
      {
        onSuccess: () => toast.success(`Update proposal for "${name}" submitted for boss approval`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );
  };

  const handleView = (name: string, version: string) => {
    logAction.mutate(
      {
        action: "Policy Viewed",
        category: "policy",
        actor: "LM-A1B2",
        details: `Viewed ${name} ${version}`,
      },
      {
        onSuccess: () => toast.success(`Viewing: ${name} ${version}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Policies &amp; Terms</h2>

      <CatalogueSection
        title="All Legal Documents"
        icon={FileText}
        records={policies}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="No policies yet"
        emptyDescription="Published policies and terms will appear here."
        columns={[
          { key: "name", header: "Document Name" },
          { key: "version", header: "Version" },
          { key: "region", header: "Region" },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
          { key: "updated", header: "Last Updated" },
        ]}
        rowActions={(policy) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`View ${policy.name}`}
              disabled={logAction.isPending}
              onClick={() => handleView(policy.name, String(policy.version ?? ""))}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <ConfirmButton
              size="sm"
              variant="ghost"
              title="Propose a policy update?"
              description={`This moves "${policy.name}" into review and writes an entry to the audit trail.`}
              confirmLabel="Propose update"
              aria-label={`Propose update for ${policy.name}`}
              disabled={updateRecord.isPending}
              onConfirm={() => handleProposeUpdate(policy.id, policy.name)}
            >
              <Edit className="h-4 w-4 text-primary" />
            </ConfirmButton>
          </>
        )}
        drawerActions={(policy) => (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={logAction.isPending}
              onClick={() => handleView(policy.name, String(policy.version ?? ""))}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
            <ConfirmButton
              size="sm"
              title="Propose a policy update?"
              description={`This moves "${policy.name}" into review and writes an entry to the audit trail.`}
              confirmLabel="Propose update"
              disabled={updateRecord.isPending}
              onConfirm={() => handleProposeUpdate(policy.id, policy.name)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Propose update
            </ConfirmButton>
          </>
        )}
      />
    </motion.div>
  );
};

export default LegalPoliciesTerms;
