import { Activity, CheckCircle2, Coins, Gauge, Pause, Percent, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-commission",
  entity: "commission",
  eyebrow: "Commission",
  title: "Commission & Payouts",
  subtitle: "Commission slabs, royalty rules, payout cycles and statements with full audit trail and RBAC.",
  icon: Percent,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Commission Payable", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Paid This Cycle", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Held / On Review", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg Commission %", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "cycle", header: "Cycle" },
    { key: "franchise", header: "Franchise" },
    { key: "base", header: "Base" },
    { key: "rate", header: "Rate" },
    { key: "adjustment", header: "Adjustment" },
    { key: "tax", header: "Tax" },
    { key: "payable", header: "Payable" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "approver", header: "Approver" },
    { key: "name", header: "Name" },
    { key: "scope", header: "Scope" },
    { key: "basis", header: "Basis" },
    { key: "min_payout", header: "Min Payout" },
    { key: "updated", header: "Updated" },
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
    { key: "cycle", label: "Cycle", type: "text", required: true },
    { key: "franchise", label: "Franchise", type: "text" },
    { key: "base", label: "Base", type: "text" },
    { key: "rate", label: "Rate", type: "text" },
    { key: "adjustment", label: "Adjustment", type: "text" },
    { key: "tax", label: "Tax", type: "text" },
    { key: "payable", label: "Payable", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
    { key: "approver", label: "Approver", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "scope", label: "Scope", type: "text" },
    { key: "basis", label: "Basis", type: "text" },
    { key: "min_payout", label: "Min Payout", type: "text" },
    { key: "updated", label: "Updated", type: "text" },
  ],
  searchFields: ["cycle", "franchise", "base"],
  primaryField: "cycle",
  panels: [{ title: "Payout Ledger", items: ["Live source pending", "Owner", "Last sync"] }],
};
