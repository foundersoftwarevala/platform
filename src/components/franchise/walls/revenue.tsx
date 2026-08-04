import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-revenue",
  entity: "revenue",
  eyebrow: "Revenue",
  title: "Revenue & Financial Operations",
  subtitle: "Consolidated revenue across royalty, subscription, license, renewals and invoices \u2014 sortable, exportable, audited.",
  icon: TrendingUp,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "MTD Revenue", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "QTD Revenue", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "YTD Revenue", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Royalty Collected", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Subscription Revenue", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "License Revenue", icon: Activity, compute: (r) => r.length ? r.length : "—" },
    { label: "Renewal Revenue", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Pending Payments", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Tax Collected", icon: Coins, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "invoice", header: "Invoice #" },
    { key: "franchise", header: "Franchise" },
    { key: "type", header: "Type", render: (r) => <StatusPill value={r.type} /> },
    { key: "amount", header: "Amount" },
    { key: "tax", header: "Tax" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "issued", header: "Issued" },
    { key: "due", header: "Due" },
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
    { key: "invoice", label: "Invoice #", type: "text", required: true },
    { key: "franchise", label: "Franchise", type: "text" },
    { key: "type", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "text" },
    { key: "tax", label: "Tax", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
    { key: "issued", label: "Issued", type: "text" },
    { key: "due", label: "Due", type: "text" },
  ],
  searchFields: ["invoice", "franchise", "type"],
  primaryField: "invoice",
  panels: [{ title: "Invoices", items: ["Live source pending", "Owner", "Last sync"] }],
};
