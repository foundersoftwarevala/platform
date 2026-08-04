import { Activity, CheckCircle2, Coins, Gauge, MessagesSquare, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-communication",
  entity: "communication",
  eyebrow: "Communication",
  title: "Global Communication",
  subtitle: "Announcements, broadcasts, internal chat and video meetings.",
  icon: MessagesSquare,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Announcements (30d)", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Broadcasts Sent", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Unread Notifications", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Active Meetings", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
    { key: "scope", header: "Scope" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "updated_at", header: "Updated" },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  bulkActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspend", label: "Suspend", icon: Pause, patch: { status: "suspended" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspend", label: "Suspend", icon: Pause, patch: { status: "suspended" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "owner", label: "Owner", type: "text" },
    { key: "scope", label: "Scope", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
    { key: "updated_at", label: "Updated", type: "text" },
  ],
  searchFields: ["name", "owner", "scope"],
  primaryField: "name",
  panels: [{ title: "Channels", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Outbox", items: ["Live source pending", "Owner", "Last sync"] }],
};
