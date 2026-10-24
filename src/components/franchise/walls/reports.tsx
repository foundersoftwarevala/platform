import { BarChart3, Coins, Gauge, ShieldCheck, TrendingUp } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

export const config: WallConfig = {
  // Reads the canonical royalty records.
  resource: "franchise_royalties",
  scope: "franchise-reports",
  entity: "report",
  eyebrow: "Reports",
  title: "Report Center",
  subtitle: "Generate, schedule and export operational reports.",
  icon: BarChart3,
  primaryLabel: "Royalty records",
  creatable: false,
  readOnly: true,
  seed: [],
  kpis: [
    { label: "Total", icon: Gauge, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", icon: TrendingUp, compute: (r) => (r.length ? r.length : "—") },
    { label: "Pending", icon: Coins, compute: (r) => (r.length ? r.length : "—") },
    { label: "Attention", icon: ShieldCheck, compute: (r) => (r.length ? r.length : "—") },
  ],
  columns: [
    { key: "period", header: "Period" },
    { key: "gross_sales", header: "Gross Sales" },
    { key: "royalty_due", header: "Royalty Due" },
    { key: "paid_amount", header: "Paid Amount" },
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
