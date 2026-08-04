import { Activity, BadgeCheck, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-license",
  entity: "license",
  eyebrow: "License",
  title: "License Management",
  subtitle: "Generate, activate, suspend, renew and audit franchise software licenses with KYC and compliance gates.",
  icon: BadgeCheck,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Active Licenses", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Suspended", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Expiring < 30d", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Expired", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg. Devices / License", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg. Domains / License", icon: Activity, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "license_key", header: "License Key" },
    { key: "franchise", header: "Franchise" },
    { key: "plan", header: "Plan" },
    { key: "devices", header: "Devices" },
    { key: "domains", header: "Domains" },
    { key: "issued", header: "Issued" },
    { key: "expires", header: "Expires" },
    { key: "kyc", header: "KYC", render: (r) => <StatusPill value={r.kyc} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
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
    { key: "license_key", label: "License Key", type: "text", required: true },
    { key: "franchise", label: "Franchise", type: "text" },
    { key: "plan", label: "Plan", type: "text" },
    { key: "devices", label: "Devices", type: "text" },
    { key: "domains", label: "Domains", type: "text" },
    { key: "issued", label: "Issued", type: "text" },
    { key: "expires", label: "Expires", type: "text" },
    { key: "kyc", label: "KYC", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
  ],
  searchFields: ["license_key", "franchise", "plan"],
  primaryField: "license_key",
  panels: [{ title: "Licenses", items: ["Live source pending", "Owner", "Last sync"] }],
};
