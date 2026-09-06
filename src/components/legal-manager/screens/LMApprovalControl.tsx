import { CheckCircle, XCircle, Lock } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMApprovalControlProps {
  activeSubSection: string;
}

const LMApprovalControl = ({ activeSubSection }: LMApprovalControlProps) => (
  <CatalogueScreen
    title="Approval & Control"
    description="Manager review queue with full decision history"
    icon={CheckCircle}
    category="approval"
    tableTitle="Approval Queue"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Item" },
      { key: "type", header: "Type" },
      { key: "requestedBy", header: "Requested by" },
      { key: "impact", header: "Impact" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Approve", status: "approved", action: "Approval Given", icon: CheckCircle, confirm: false },
      { label: "Reject", status: "rejected", action: "Approval Rejected", icon: XCircle, confirm: true },
      { label: "Lock", status: "locked", action: "Approval Locked", icon: Lock, confirm: true },
    ]}
  />
);

export default LMApprovalControl;
