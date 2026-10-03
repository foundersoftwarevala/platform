import { Msg } from "@/lib/i18n/use-translation";
import { Bell, CheckCheck, Send, Trash2, Megaphone, AlertTriangle, Info } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const TYPES = ["info", "success", "warning", "critical"] as const;
const STATUSES = ["scheduled", "active", "expired"] as const;
const AUDIENCES = ["all", "resellers", "customers", "admins"] as const;

export const config: WallConfig = {
  // Reads reseller_notifications, whose columns are exactly the five this wall
  // renders. Nothing on the platform reads that table: a reseller sees what is
  // in user_notifications, written only by the database's own mm_notify. A
  // broadcast created or published here was saved and reached nobody, so the
  // controls stay, disabled, and say why.
  resource: "reseller_notifications",
  unavailable:
    "Broadcasts are not delivered from here. Resellers are notified through the platform's " +
    "notification system (user_notifications), which no operator screen can write to yet, " +
    "and nothing reads the rows on this wall.",
  scope: "notifications", entity: "notification", route: "/notifications",
  eyebrow: "Broadcast", title: "Notifications Wall",
  subtitle: "Announcements, alerts and system messages across every audience.",
  icon: Bell, primaryLabel: "New Broadcast",
  seed: [],
  columns: [
    { key: "title", header: "Title", render: (r) => <div className="font-semibold text-[13px]">{r.title}</div> },
    { key: "type", header: "Type", render: (r) => <StatusPill value={r.type} /> },
    { key: "audience", header: "Audience", render: (r) => <StatusPill value={r.audience} /> },
    { key: "scheduled_at", header: "Scheduled" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "type", label: "Type", options: TYPES },
    { key: "audience", label: "Audience", options: AUDIENCES },
    { key: "status", label: "Status", options: STATUSES },
  ],
  kpis: [
    { label: "Active", icon: Megaphone, compute: (r) => r.filter((x) => x.status === "active").length },
    { label: "Scheduled", icon: Send, compute: (r) => r.filter((x) => x.status === "scheduled").length },
    { label: "Warnings", icon: AlertTriangle, compute: (r) => r.filter((x) => x.type === "warning" || x.type === "critical").length },
    { label: "Total", icon: Bell, compute: (r) => r.length },
  ],
  bulkActions: [
    { key: "publish", label: "Publish", icon: Send, patch: { status: "active" } },
    { key: "archive", label: "Archive", icon: CheckCheck, patch: { status: "expired" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "publish", label: "Publish", icon: Send, patch: { status: "active" } },
    { key: "archive", label: "Archive", icon: CheckCheck, patch: { status: "expired" }, destructive: true },
  ],
  formFields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Message", type: "textarea", placeholder: "Broadcast message body…" },
    { key: "type", label: "Type", type: "select", options: TYPES, defaultValue: "info" },
    { key: "audience", label: "Audience", type: "select", options: AUDIENCES, defaultValue: "resellers" },
    { key: "scheduled_at", label: "Send at", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "scheduled" },
  ],
  searchFields: ["title", "body", "audience"],
  primaryField: "title", subField: "audience",
  renderDetail: (r) => (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</div>
      <p className="mt-2 whitespace-pre-wrap text-[13px] text-foreground/90">
        {r.body || <span className="text-muted-foreground">No message body.</span>}
      </p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3" /> <Msg k="reseller.walls.audience_recorded" /> <span className="font-semibold text-foreground">{r.audience}</span> <Msg k="reseller.walls.not_delivered" />
      </div>
    </>
  ),
};
