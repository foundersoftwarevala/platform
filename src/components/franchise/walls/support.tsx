import { HeartHandshake, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
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
    { key: "name", header: "Name" },
    { key: "owner", header: "Owner" },
    { key: "scope", header: "Scope" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "updated_at", header: "Updated" },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  bulkActions: [],
  rowActions: [],
  formFields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "owner", label: "Owner", type: "text" },
    { key: "scope", label: "Scope", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
    { key: "updated_at", label: "Updated", type: "text" },
  ],
  searchFields: ["name", "owner", "scope"],
  primaryField: "name",
  panels: [{ title: "Channels", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Tickets", items: ["Live source pending", "Owner", "Last sync"] }],
};
