import { CheckCircle2, Gauge, Package, Pause, TrendingUp } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

export const config: WallConfig = {
  resource: "franchise_product_assignments",
  scope: "franchise-products",
  entity: "product assignment",
  eyebrow: "Products",
  title: "Product Assignment",
  subtitle: "Assign catalogue products to specific franchises.",
  icon: Package,
  primaryLabel: "Assign Product",
  seed: [],
  kpis: [
    { label: "Assignments", icon: Gauge, compute: (rows) => rows.length || "—" },
    {
      label: "Active",
      icon: TrendingUp,
      compute: (rows) => rows.filter((row) => row.active).length || "—",
    },
  ],
  columns: [
    {
      key: "franchise_id",
      header: "Franchise",
      render: (row) => <span className="font-mono text-xs">{row.franchise_id}</span>,
    },
    {
      key: "product_id",
      header: "Product",
      render: (row) => <span className="font-mono text-xs">{row.product_id}</span>,
    },
    {
      key: "active",
      header: "Status",
      render: (row) => <StatusPill value={row.active ? "active" : "inactive"} />,
    },
    { key: "created_at", header: "Assigned" },
  ],
  filters: [],
  bulkActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { active: true } },
    {
      key: "suspend",
      label: "Deactivate",
      icon: Pause,
      patch: { active: false },
      variant: "destructive",
    },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { active: true } },
    {
      key: "suspend",
      label: "Deactivate",
      icon: Pause,
      patch: { active: false },
      destructive: true,
    },
  ],
  formFields: [
    {
      key: "franchise_id",
      label: "Franchise",
      type: "resource-select",
      optionsResource: "franchises",
      optionLabel: "franchise",
      createOnly: true,
      required: true,
    },
    {
      key: "product_id",
      label: "Marketplace product",
      type: "resource-select",
      optionsResource: "products",
      optionLabel: "name",
      createOnly: true,
      required: true,
    },
  ],
  searchFields: [],
  primaryField: "product_id",
  statusField: "active",
  panels: [
    {
      title: "Assignments",
      items: ["Active assignments are visible to the linked franchise dashboard."],
    },
  ],
};
