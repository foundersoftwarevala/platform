import { FileText, CheckCircle, Archive } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMPolicyManagementProps {
  activeSubSection: string;
}

const LMPolicyManagement = ({ activeSubSection }: LMPolicyManagementProps) => (
  <CatalogueScreen
    title="Policy Management"
    description="Every published policy, its version and effective region"
    icon={FileText}
    category="policy"
    tableTitle="Policy Library"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Policy" },
      { key: "type", header: "Category" },
      { key: "version", header: "Version" },
      { key: "region", header: "Region" },
      { key: "updated", header: "Last updated" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Publish", status: "active", action: "Policy Published", icon: CheckCircle, confirm: false },
      { label: "Archive", status: "archived", action: "Policy Archived", icon: Archive, confirm: true },
    ]}
  />
);

export default LMPolicyManagement;
