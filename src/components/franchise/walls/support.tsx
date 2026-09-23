import { Activity, CheckCircle2, Coins, Gauge, HeartHandshake, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_escalations.
  resource: "franchise_escalations",
  scope: "franchise-support",
  entity: "support",
  eyebrow: "Support",
  title: "Franchise Support Operations",
  subtitle: "Tickets, calls, meetings, escalations and SLA tracking.",
  icon: HeartHandshake,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Open Tickets", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Breached SLA", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg First Response", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "CSAT", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Active Chats", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Scheduled Meetings", icon: Activity, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "title", header: "Escalation", render: (r) => <div className="font-semibold text-[13px]">{r.title || "—"}</div> },
    { key: "category", header: "Category" },
    { key: "priority", header: "Priority", render: (r) => <StatusPill value={r.priority} /> },
    { key: "assigned_to", header: "Assigned" },
    { key: "sla_due", header: "SLA due" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
  ],
  bulkActions: [
    { key: "resolved", label: "Resolve", icon: CheckCircle2, patch: { status: "resolved" } },
    { key: "closed", label: "Close", icon: Pause, patch: { status: "closed" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "resolved", label: "Resolve", icon: CheckCircle2, patch: { status: "resolved" } },
    { key: "closed", label: "Close", icon: Pause, patch: { status: "closed" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "priority", label: "Priority", type: "text" },
    { key: "assigned_to", label: "Assigned to", type: "text" },
    { key: "resolution", label: "Resolution", type: "textarea" },
  ],
  searchFields: ["title", "category", "status"],
  primaryField: "title",
  panels: [{ title: "Channels", items: ["Owner", "Last sync"] }, { title: "Tickets", items: ["Live source pending", "Owner", "Last sync"] }],
};
