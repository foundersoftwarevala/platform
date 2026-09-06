import { DoorOpen, CheckCircle, XCircle } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMLoginGateControlProps {
  activeSubSection: string;
}

const LMLoginGateControl = ({ activeSubSection }: LMLoginGateControlProps) => (
  <CatalogueScreen
    title="Login Gate Control"
    description="Enforcement rules shown before a user can enter the platform"
    icon={DoorOpen}
    category="login_gate"
    tableTitle="Gate Enforcement Rules"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Rule" },
      { key: "type", header: "Type" },
      { key: "enforcement", header: "Enforcement" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Enable", status: "enabled", action: "Login Gate Rule Enabled", icon: CheckCircle, confirm: false },
      { label: "Disable", status: "disabled", action: "Login Gate Rule Disabled", icon: XCircle, confirm: true },
    ]}
  />
);

export default LMLoginGateControl;
