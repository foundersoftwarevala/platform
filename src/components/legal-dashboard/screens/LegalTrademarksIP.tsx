import { motion } from "framer-motion";
import { AlertTriangle, Award, Clock, Globe, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useLogAction } from "@/lib/legal-data";

const LegalTrademarksIP = () => {
  const {
    data: trademarks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useLegalRecords("trademark");
  const {
    data: pendingApplications = [],
    isLoading: appsLoading,
    isError: appsError,
    error: appsErrorObj,
    refetch: refetchApps,
  } = useLegalRecords("trademark_application");
  const logAction = useLogAction();

  const handleAddRecord = () =>
    logAction.mutate(
      {
        action: "Trademark Record Requested",
        category: "trademark",
        actor: "LM-A1B2",
        details: "New trademark record submitted for approval",
      },
      {
        onSuccess: () => toast.info("Trademark record addition submitted for approval"),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );

  const handleRenewRequest = (ref: string) =>
    logAction.mutate(
      {
        action: "Trademark Renewal Requested",
        category: "trademark",
        actor: "LM-A1B2",
        details: `Renewal request submitted for ${ref}`,
      },
      {
        onSuccess: () => toast.info(`Renewal request for ${ref} submitted for approval`),
        onError: (mutationError) => toast.error(mutationError.message),
      },
    );

  const now = Date.now();
  const expiringSoon = trademarks.filter((tm) => {
    if (!tm.expiry || tm.expiry === "N/A") return false;
    const ts = new Date(tm.expiry).getTime();
    return !Number.isNaN(ts) && ts - now < 1000 * 60 * 60 * 24 * 365;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Trademarks &amp; IP</h2>
        <Button onClick={handleAddRecord} disabled={logAction.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
      </div>

      <CatalogueSection
        title="Registered Trademarks"
        icon={Award}
        records={trademarks}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="No trademarks registered"
        emptyDescription="Registered marks will be listed here."
        columns={[
          { key: "name", header: "Mark" },
          { key: "type", header: "Class" },
          {
            key: "regions",
            header: "Regions",
            render: (r) => (Array.isArray(r.regions) ? r.regions.join(", ") : String(r.regions ?? "—")),
          },
          { key: "expiry", header: "Expires" },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(tm) =>
          tm.status === "registered" ? (
            <ConfirmButton
              size="sm"
              variant="ghost"
              title="Request renewal?"
              description={`A renewal request for ${tm.ref_code ?? tm.name} is submitted for approval and logged.`}
              confirmLabel="Request renewal"
              aria-label={`Request renewal for ${tm.name}`}
              disabled={logAction.isPending}
              onConfirm={() => handleRenewRequest(tm.ref_code ?? tm.name)}
            >
              <RefreshCw className="h-4 w-4 text-primary" />
            </ConfirmButton>
          ) : null
        }
        drawerActions={(tm) =>
          tm.status === "registered" ? (
            <ConfirmButton
              size="sm"
              title="Request renewal?"
              description={`A renewal request for ${tm.ref_code ?? tm.name} is submitted for approval and logged.`}
              confirmLabel="Request renewal"
              disabled={logAction.isPending}
              onConfirm={() => handleRenewRequest(tm.ref_code ?? tm.name)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Renew request
            </ConfirmButton>
          ) : null
        }
      />

      <CatalogueSection
        title="Pending Applications"
        icon={Clock}
        records={pendingApplications}
        isLoading={appsLoading}
        isError={appsError}
        error={appsErrorObj as { message?: string } | null}
        onRetry={() => void refetchApps()}
        emptyTitle="No pending applications"
        emptyDescription="Filed applications awaiting a registry decision will appear here."
        columns={[
          { key: "name", header: "Application" },
          { key: "filed", header: "Filed" },
          { key: "region", header: "Region", render: (r) => (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {String(r.region ?? "—")}
            </span>
          ) },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
      />

      {expiringSoon.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500 border-border bg-card/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-400" aria-hidden="true" />
              <div>
                <h4 className="font-medium text-yellow-400">Expiry Alerts</h4>
                {expiringSoon.map((tm) => (
                  <p key={tm.id} className="mt-1 text-sm text-muted-foreground">
                    {tm.name} expires on {tm.expiry}. Consider initiating renewal process.
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default LegalTrademarksIP;
