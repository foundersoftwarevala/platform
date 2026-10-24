import { BarChart3, Coins, Gauge, ShieldCheck, TrendingUp } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

export const config: WallConfig = {
  // Reads the canonical royalty records.
  resource: "franchise_royalties",
  scope: "franchise-analytics",
  entity: "analytic",
  eyebrow: "Analytics",
  title: "Franchise Analytics",
  subtitle: "Deep analytics across every operational and financial dimension.",
  icon: BarChart3,
  primaryLabel: "Royalty records",
  creatable: false,
  readOnly: true,
  seed: [],
  kpis: [
    { label: "MAU", icon: Gauge, compute: (r) => (r.length ? r.length : "—") },
    { label: "Revenue / Franchise", icon: TrendingUp, compute: (r) => (r.length ? r.length : "—") },
    { label: "Retention", icon: Coins, compute: (r) => (r.length ? r.length : "—") },
    { label: "Forecast Accuracy", icon: ShieldCheck, compute: (r) => (r.length ? r.length : "—") },
  ],
  columns: [
    { key: "period", header: "Period" },
    { key: "gross_sales", header: "Gross Sales", align: "right" },
    { key: "royalty_due", header: "Royalty Due", align: "right" },
    { key: "paid_amount", header: "Paid Amount", align: "right" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [],
  bulkActions: [],
  rowActions: [],
  formFields: [],
  searchFields: ["period", "status"],
  primaryField: "period",
  panels: [],
};
