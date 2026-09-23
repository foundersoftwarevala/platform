import { Activity, CheckCircle2, Coins, Gauge, MessagesSquare, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["info", "warning", "success", "critical"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_notifications.
  resource: "franchise_notifications",
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
    { key: "title", header: "Title", render: (r) => <div className="font-semibold text-[13px]">{r.title || "—"}</div> },
    { key: "message", header: "Message", render: (r) => <span className="text-[12px]">{String(r.message ?? "").slice(0, 60) || "—"}</span> },
    { key: "type", header: "Type", render: (r) => <StatusPill value={r.type} /> },
    { key: "read", header: "Read", render: (r) => <StatusPill value={r.read ? "read" : "unread"} /> },
    { key: "created_at", header: "Sent" },
  ],
  filters: [
    { key: "type", label: "Type", options: STATUSES },
  ],
  bulkActions: [
    { key: "true", label: "Mark Read", icon: CheckCircle2, patch: { read: true } },
  ],
  rowActions: [
    { key: "true", label: "Mark Read", icon: CheckCircle2, patch: { read: true } },
  ],
  formFields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "message", label: "Message", type: "textarea" },
    { key: "type", label: "Type", type: "select", options: STATUSES },
  ],
  searchFields: ["title", "message", "type"],
  primaryField: "title",
  statusField: "type",
  panels: [{ title: "Channels", items: ["Owner", "Last sync"] }, { title: "Outbox", items: ["Live source pending", "Owner", "Last sync"] }],
};
