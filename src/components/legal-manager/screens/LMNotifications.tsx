import { AlertTriangle, Bell, Check, Clock, FileText, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CatalogueScreen, statusBadge } from "../common/CatalogueScreen";
import { subsectionLabel } from "../common/subsection";
import { useLegalRecords } from "@/lib/legal-data";

interface LMNotificationsProps {
  activeSubSection: string;
}

const GROUPS = [
  { icon: Clock, label: "Expiry Alerts", terms: ["expiry", "expire"] },
  { icon: AlertTriangle, label: "Violations", terms: ["violation", "breach"] },
  { icon: Users, label: "Pending Acceptances", terms: ["pending", "acceptance"] },
  { icon: FileText, label: "Policy Changes", terms: ["policy", "change"] },
];

const priorityBadge = (priority: string) => {
  const tone =
    priority === "critical"
      ? "bg-red-500/15 text-red-400"
      : priority === "high"
        ? "bg-orange-500/15 text-orange-400"
        : priority === "medium"
          ? "bg-yellow-500/15 text-yellow-400"
          : "bg-blue-500/15 text-blue-400";
  return <Badge className={tone}>{priority || "normal"}</Badge>;
};

const LMNotifications = ({ activeSubSection }: LMNotificationsProps) => {
  const { data: notifications = [] } = useLegalRecords("notification");

  const tiles = GROUPS.map((group) => ({
    icon: group.icon,
    label: group.label,
    value: String(
      notifications.filter((item) => {
        const searchable = `${item.name} ${item.message ?? ""} ${item.type ?? ""}`.toLowerCase();
        return group.terms.some((term) => searchable.includes(term));
      }).length,
    ),
    hint: "live count",
  }));

  return (
    <CatalogueScreen
      title="Notifications"
      description="Legal alerts, expiries and policy changes that need attention"
      icon={Bell}
      category="notification"
      tableTitle="All Notifications"
      focusLabel={subsectionLabel(activeSubSection)}
      tiles={tiles}
      columns={[
        { key: "name", header: "Notification" },
        { key: "message", header: "Detail" },
        { key: "priority", header: "Priority", render: (r) => priorityBadge(String(r.priority ?? "")) },
        { key: "time", header: "Raised" },
        { key: "status", header: "Status", render: (r) => statusBadge(String(r.status)) },
      ]}
      actions={[
        { label: "Assign", status: "under_review", action: "Notification Assigned", icon: Check, confirm: false },
        { label: "Dismiss", status: "dismissed", action: "Notification Dismissed", icon: X, confirm: true },
      ]}
      emptyTitle="Inbox clear"
      emptyDescription="No legal notifications match the current filters."
    />
  );
};

export default LMNotifications;
