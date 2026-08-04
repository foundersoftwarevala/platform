import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Target, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-leads",
  entity: "lead",
  eyebrow: "Leads",
  title: "Franchise Leads",
  subtitle: "Inbound franchise enquiries, source attribution and conversion pipeline.",
  icon: Target,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "New Leads", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Qualified", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "In Discussion", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Converted", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Dropped", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Conversion Rate", icon: Activity, compute: (r) => r.length ? r.length : "—" },
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
  panels: [{ title: "Pipeline", items: ["Live source pending", "Owner", "Last sync"] }],
};
