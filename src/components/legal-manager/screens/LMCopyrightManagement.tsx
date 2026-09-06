import { Copyright, CheckCircle, AlertTriangle } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMCopyrightManagementProps {
  activeSubSection: string;
}

const LMCopyrightManagement = ({ activeSubSection }: LMCopyrightManagementProps) => (
  <CatalogueScreen
    title="Copyright Management"
    description="Ownership declarations, registrations and violation records"
    icon={Copyright}
    category="copyright"
    tableTitle="Copyright Register"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Asset" },
      { key: "type", header: "Type" },
      { key: "year", header: "Year" },
      { key: "protection", header: "Protection" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Register", status: "registered", action: "Copyright Registered", icon: CheckCircle, confirm: false },
      { label: "Flag violation", status: "violation", action: "Copyright Violation Flagged", icon: AlertTriangle, confirm: true },
    ]}
  />
);

export default LMCopyrightManagement;
