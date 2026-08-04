import { Activity, CheckCircle2, Coins, Gauge, Package, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-products",
  entity: "product",
  eyebrow: "Products",
  title: "Product Assignment",
  subtitle: "Assign products, categories, pricing and regional rules to franchises.",
  icon: Package,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Total Products", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Assigned", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Regional Rules", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Discount Rules", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
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
  panels: [{ title: "Catalog Types", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Assignments", items: ["Live source pending", "Owner", "Last sync"] }],
};
