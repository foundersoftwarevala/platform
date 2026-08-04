import { Bell, CheckCheck, Send, Trash2, Megaphone, AlertTriangle, Info } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const TYPES = ["info", "success", "warning", "critical"] as const;
const STATUSES = ["scheduled", "active", "expired"] as const;
const AUDIENCES = ["all", "resellers", "customers", "admins"] as const;

export const config: WallConfig = {
  scope: "notifications", entity: "notification", route: "/notifications",
  eyebrow: "Broadcast", title: "Notifications Wall",
  subtitle: "Announcements, alerts and system messages across every audience.",
  icon: Bell, primaryLabel: "New Broadcast",
  seed: [
    { id: "N-1", title: "Q3 commission cycle closes July 31", type: "info", audience: "resellers", status: "active", scheduled_at: "2026-07-10", created_at: "2026-07-10" },
    { id: "N-2", title: "Scheduled maintenance — July 14, 02:00 IST", type: "warning", audience: "all", status: "scheduled", scheduled_at: "2026-07-13", created_at: "2026-07-09" },
    { id: "N-3", title: "New enterprise plan launched", type: "success", audience: "resellers", status: "active", scheduled_at: "2026-07-01", created_at: "2026-07-01" },
    { id: "N-4", title: "KYC deadline extended", type: "critical", audience: "resellers", status: "expired", scheduled_at: "2026-06-20", created_at: "2026-06-15" },
  ],
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
        <Info className="h-3 w-3" /> Broadcast delivered to <span className="font-semibold text-foreground">{r.audience}</span>
      </div>
    </>
  ),
};
