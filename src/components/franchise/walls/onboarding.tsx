import { UserPlus, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-onboarding",
  entity: "onboarding",
  eyebrow: "Onboarding",
  title: "Franchise Onboarding",
  subtitle: "Standardised onboarding journey from signed agreement to go-live.",
  icon: UserPlus,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "In Onboarding", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Payment", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Training", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Go-Live This Week", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg. Time to Go-Live", icon: Users, compute: (r) => r.length ? r.length : "—" },
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
  panels: [{ title: "Standard Journey", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Active Onboardings", items: ["Live source pending", "Owner", "Last sync"] }],
};
