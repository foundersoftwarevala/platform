import { motion } from "framer-motion";
import { AlertTriangle, Eye, FileSignature } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useLogAction, useUpdateRecordStatus } from "@/lib/legal-data";

const LegalContracts = () => {
  const { data: contracts = [], isLoading, isError, error, refetch } = useLegalRecords("contract");
  const logAction = useLogAction();
  const updateRecord = useUpdateRecordStatus();

  const handleReview = (id: string, ref: string) => {
    updateRecord.mutate(
      {
        id,
        category: "contract",
        status: "under_review",
        action: "Contract Reviewed",
        details: `Contract ${ref} moved to review`,
      },
      {
        onSuccess: () => toast.info(`Reviewing contract ${ref}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );
  };

  const handleFlagRisk = (ref: string) => {
    logAction.mutate(
      {
        action: "Contract Risk Flagged",
        category: "contract",
        actor: "LM-A1B2",
        details: `Risk flagged for contract ${ref}`,
      },
      {
        onSuccess: () => toast.warning(`Risk flagged for contract ${ref}`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );
  };

  const stats = [
    { label: "Total Contracts", value: contracts.length, tone: "text-foreground" },
    { label: "Active", value: contracts.filter((c) => c.status === "active").length, tone: "text-emerald-400" },
    { label: "Expiring Soon", value: contracts.filter((c) => c.status === "expiring_soon").length, tone: "text-yellow-400" },
    { label: "Under Review", value: contracts.filter((c) => c.status === "under_review").length, tone: "text-blue-400" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Contracts</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border bg-card/50">
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`mt-2 text-3xl font-bold ${stat.tone}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CatalogueSection
        title="All Contracts"
        icon={FileSignature}
        records={contracts}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="No contracts found"
        emptyDescription="Contracts will appear here once they exist in the legal workspace."
        columns={[
          { key: "ref_code", header: "Contract ID", className: "font-mono text-primary" },
          { key: "name", header: "Party" },
          { key: "region", header: "Region" },
          { key: "validity", header: "Validity" },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(contract) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Review contract ${contract.ref_code ?? contract.name}`}
              disabled={updateRecord.isPending}
              onClick={() => handleReview(contract.id, contract.ref_code ?? contract.name)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <ConfirmButton
              size="sm"
              variant="ghost"
              title="Flag this contract as a risk?"
              description={`A risk flag for ${contract.ref_code ?? contract.name} is written to the immutable audit trail.`}
              confirmLabel="Flag risk"
              aria-label={`Flag risk for ${contract.ref_code ?? contract.name}`}
              disabled={logAction.isPending}
              onConfirm={() => handleFlagRisk(contract.ref_code ?? contract.name)}
            >
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </ConfirmButton>
          </>
        )}
        drawerActions={(contract) => (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={updateRecord.isPending}
              onClick={() => handleReview(contract.id, contract.ref_code ?? contract.name)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Move to review
            </Button>
            <ConfirmButton
              size="sm"
              variant="destructive"
              title="Flag this contract as a risk?"
              description={`A risk flag for ${contract.ref_code ?? contract.name} is written to the immutable audit trail.`}
              confirmLabel="Flag risk"
              disabled={logAction.isPending}
              onConfirm={() => handleFlagRisk(contract.ref_code ?? contract.name)}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Flag risk
            </ConfirmButton>
          </>
        )}
      />
    </motion.div>
  );
};

export default LegalContracts;
