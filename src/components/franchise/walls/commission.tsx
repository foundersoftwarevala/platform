import { Coins, Gauge, Percent, ShieldCheck, TrendingUp } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

export const config: WallConfig = {
  // Reads franchise_royalties - what each franchise is owed and has been paid.
  resource: "franchise_royalties",
  scope: "franchise-commission",
  entity: "commission",
  eyebrow: "Commission",
  title: "Commission & Payouts",
  subtitle: "Read-only royalty records showing sales, amounts due, payments and status.",
  icon: Percent,
  primaryLabel: "Royalty records",
  creatable: false,
  readOnly: true,
  seed: [],
  kpis: [
    { label: "Commission Payable", icon: Gauge, compute: (r) => (r.length ? r.length : "—") },
    { label: "Paid This Cycle", icon: TrendingUp, compute: (r) => (r.length ? r.length : "—") },
    { label: "Held / On Review", icon: Coins, compute: (r) => (r.length ? r.length : "—") },
    { label: "Avg Commission %", icon: ShieldCheck, compute: (r) => (r.length ? r.length : "—") },
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
