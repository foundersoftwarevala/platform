import { Award, CheckCircle, AlertTriangle } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMTrademarkManagementProps {
  activeSubSection: string;
}

const LMTrademarkManagement = ({ activeSubSection }: LMTrademarkManagementProps) => (
  <CatalogueScreen
    title="Trademark Management"
    description="Registered marks, applications and renewal windows"
    icon={Award}
    category="trademark"
    tableTitle="Trademark Portfolio"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Mark" },
      { key: "type", header: "Class" },
      { key: "expiry", header: "Renewal due" },
      { key: "regions", header: "Regions", render: (r) => (Array.isArray(r.regions) ? r.regions.join(", ") : String(r.regions ?? "—")) },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Mark registered", status: "registered", action: "Trademark Registered", icon: CheckCircle, confirm: false },
      { label: "Send to review", status: "review", action: "Trademark Sent For Review", icon: AlertTriangle, confirm: true },
    ]}
  />
);

export default LMTrademarkManagement;
