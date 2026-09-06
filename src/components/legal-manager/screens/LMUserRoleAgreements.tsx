import { Users, CheckCircle, Lock } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMUserRoleAgreementsProps {
  activeSubSection: string;
}

const LMUserRoleAgreements = ({ activeSubSection }: LMUserRoleAgreementsProps) => (
  <CatalogueScreen
    title="User & Role Agreements"
    description="Agreements for every user role and their acceptance coverage"
    icon={Users}
    category="role_agreement"
    tableTitle="Role Agreements"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Agreement" },
      { key: "role", header: "Role" },
      { key: "version", header: "Version" },
      { key: "acceptances", header: "Acceptances" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Publish", status: "active", action: "Role Agreement Published", icon: CheckCircle, confirm: false },
      { label: "Lock", status: "locked", action: "Role Agreement Locked", icon: Lock, confirm: true },
    ]}
  />
);

export default LMUserRoleAgreements;
