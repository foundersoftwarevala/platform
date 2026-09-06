import { motion } from "framer-motion";
import { Check, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useUpdateRecordStatus } from "@/lib/legal-data";

const LegalApprovals = () => {
  const { data: approvals = [], isLoading, isError, error, refetch } = useLegalRecords("approval");
  const updateRecord = useUpdateRecordStatus();

  const decide = (id: string, ref: string, approve: boolean) =>
    updateRecord.mutate(
      {
        id,
        category: "approval",
        status: approve ? "approved" : "rejected",
        action: approve ? "Approval Given" : "Approval Rejected",
        details: `Approval ${ref} ${approve ? "approved" : "rejected"}`,
      },
      {
        onSuccess: () =>
          approve ? toast.success(`Approval ${ref} approved`) : toast.error(`Approval ${ref} rejected`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Approvals</h2>
        <Badge className="bg-yellow-500/20 text-yellow-400">
          {approvals.filter((a) => a.status === "pending").length} Pending
        </Badge>
      </div>

      <CatalogueSection
        title="Approval Queue"
        icon={CheckCircle}
        records={approvals}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="Queue is clear"
        emptyDescription="Nothing is waiting for a decision right now."
        columns={[
          { key: "name", header: "Item" },
          { key: "requestedBy", header: "Requested By", className: "font-mono text-sm" },
          { key: "impact", header: "Impact" },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(approval) => {
          if (approval.status !== "pending") return null;
          const ref = approval.ref_code ?? approval.name;
          return (
            <>
              <ConfirmButton
                size="sm"
                title="Approve this item?"
                description={`${ref} will be marked approved and recorded in the audit trail.`}
                confirmLabel="Approve"
                aria-label={`Approve ${ref}`}
                disabled={updateRecord.isPending}
                onConfirm={() => decide(approval.id, ref, true)}
              >
                <Check className="h-4 w-4" />
              </ConfirmButton>
              <ConfirmButton
                size="sm"
                variant="destructive"
                title="Reject this item?"
                description={`${ref} will be marked rejected and recorded in the audit trail.`}
                confirmLabel="Reject"
                aria-label={`Reject ${ref}`}
                disabled={updateRecord.isPending}
                onConfirm={() => decide(approval.id, ref, false)}
              >
                <X className="h-4 w-4" />
              </ConfirmButton>
            </>
          );
        }}
      />
    </motion.div>
  );
};

export default LegalApprovals;
