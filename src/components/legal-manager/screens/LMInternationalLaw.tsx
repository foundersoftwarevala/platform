import { Globe, CheckCircle, AlertTriangle } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMInternationalLawProps {
  activeSubSection: string;
}

const LMInternationalLaw = ({ activeSubSection }: LMInternationalLawProps) => (
  <CatalogueScreen
    title="International Law Compliance"
    description="Regulation coverage across every operating region"
    icon={Globe}
    category="international_law"
    tableTitle="Regulatory Coverage"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Regulation" },
      { key: "region", header: "Region" },
      { key: "coverage", header: "Coverage" },
      { key: "lastAudit", header: "Last audit" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[
      { label: "Mark compliant", status: "compliant", action: "Compliance Reviewed", icon: CheckCircle, confirm: false },
      { label: "Flag review", status: "review", action: "Compliance Flagged For Review", icon: AlertTriangle, confirm: true },
    ]}
  />
);

export default LMInternationalLaw;
