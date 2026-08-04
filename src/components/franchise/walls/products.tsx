import { Package, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

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
  panels: [{ title: "Catalog Types", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Assignments", items: ["Live source pending", "Owner", "Last sync"] }],
};
