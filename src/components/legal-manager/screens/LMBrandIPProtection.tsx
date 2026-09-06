import { Shield, CheckCircle, Lock } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMBrandIPProtectionProps {
  activeSubSection: string;
}

const LMBrandIPProtection = ({ activeSubSection }: LMBrandIPProtectionProps) => (
  <CatalogueScreen
    title="Brand & IP Protection"
    description="Brand usage rules, white-label limits and abuse handling"
    icon={Shield}
    category="brand_ip"
    tableTitle="Brand Protection Controls"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Control" },
      { key: "type", header: "Type" },
      { key: "coverage", header: "Coverage" },
      { key: "enforcement", header: "Enforcement" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Activate", status: "active", action: "Brand Control Activated", icon: CheckCircle, confirm: false },
      { label: "Suspend", status: "suspended", action: "Brand Control Suspended", icon: Lock, confirm: true },
    ]}
  />
);

export default LMBrandIPProtection;
