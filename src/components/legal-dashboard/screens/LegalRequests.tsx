import { motion } from "framer-motion";
import { AlertTriangle, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogueSection } from "@/components/legal-manager/common/CatalogueSection";
import { ConfirmButton } from "@/components/legal-manager/common/ConfirmButton";
import { statusBadge } from "@/components/legal-manager/common/CatalogueScreen";
import { useLegalRecords, useUpdateRecordStatus } from "@/lib/legal-data";

const priorityBadge = (priority: string) => {
  const tone =
    priority === "critical"
      ? "bg-red-500/20 text-red-400"
      : priority === "high"
        ? "bg-orange-500/20 text-orange-400"
        : priority === "medium"
          ? "bg-yellow-500/20 text-yellow-400"
          : priority === "low"
            ? "bg-blue-500/20 text-blue-400"
            : "bg-muted/20 text-muted-foreground";
  return <Badge className={tone}>{priority || "normal"}</Badge>;
};

const LegalRequests = () => {
  const { data: requests = [], isLoading, isError, error, refetch } = useLegalRecords("legal_request");
  const updateRecord = useUpdateRecordStatus();

  const mutate = (id: string, ref: string, status: string, action: string, details: string, message: () => void) => {
    updateRecord.mutate(
      { id, category: "legal_request", status, action, details },
      { onSuccess: message, onError: (mutationError) => toast.error(mutationError.message) },
    );
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Legal Requests</h2>
        <Badge className="bg-primary/15 text-primary">{pendingCount} Pending</Badge>
      </div>

      <CatalogueSection
        title="All Requests"
        icon={MessageSquare}
        records={requests}
        isLoading={isLoading}
        isError={isError}
        error={error as { message?: string } | null}
        onRetry={() => void refetch()}
        emptyTitle="No legal requests"
        emptyDescription="Requests raised by other teams will show up here."
        columns={[
          { key: "ref_code", header: "Request ID", className: "font-mono text-primary" },
          { key: "raisedBy", header: "Raised By", className: "font-mono text-sm" },
          { key: "type", header: "Type", render: (r) => String(r.type || r.name) },
          { key: "priority", header: "Priority", render: (r) => priorityBadge(String(r.priority ?? "")) },
          { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
        ]}
        rowActions={(request) => {
          const ref = request.ref_code ?? request.name;
          return (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Review request ${ref}`}
                disabled={updateRecord.isPending}
                onClick={() =>
                  mutate(request.id, ref, "in_progress", "Legal Request Reviewed", `Request ${ref} under review`, () =>
                    toast.info(`Reviewing request ${ref}`),
                  )
                }
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Resolve request ${ref}`}
                disabled={updateRecord.isPending}
                onClick={() =>
                  mutate(request.id, ref, "resolved", "Legal Request Resolved", `Response sent for request ${ref}`, () =>
                    toast.success(`Response sent for request ${ref}`),
                  )
                }
              >
                <MessageSquare className="h-4 w-4 text-emerald-400" />
              </Button>
              <ConfirmButton
                size="sm"
                variant="ghost"
                title="Escalate to Super Admin?"
                description={`Request ${ref} is escalated and the action is written to the audit trail.`}
                confirmLabel="Escalate"
                aria-label={`Escalate request ${ref}`}
                disabled={updateRecord.isPending}
                onConfirm={() =>
                  mutate(request.id, ref, "escalated", "Legal Request Escalated", `Request ${ref} escalated to Super Admin`, () =>
                    toast.warning(`Request ${ref} escalated to Super Admin`),
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

export default LegalRequests;
