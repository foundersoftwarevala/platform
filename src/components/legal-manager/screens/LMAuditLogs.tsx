import { History } from "lucide-react";

import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";

interface LMAuditLogsProps {
  activeSubSection: string;
}

const LMAuditLogs = ({ activeSubSection }: LMAuditLogsProps) => (
  <CatalogueScreen
    title="Audit & Logs"
    description="Acceptance, version and compliance events captured by the platform"
    icon={History}
    category="audit"
    tableTitle="Audit Records"
    focusLabel={subsectionLabel(activeSubSection)}
    columns={[
      { key: "name", header: "Event" },
      { key: "type", header: "Category" },
      { key: "user", header: "Actor" },
      { key: "timestamp", header: "When" },
      { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
    ]}
    actions={[

    ]}
  />
);

export default LMAuditLogs;
