import { Activity, CheckCircle2, Coins, Gauge, Pause, Settings, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_settings.
  resource: "franchise_settings",
  scope: "franchise-settings",
  entity: "setting",
  eyebrow: "Settings",
  title: "Platform Settings",
  subtitle: "Configure rules, templates, security, integrations and system operations.",
  icon: Settings,
  primaryLabel: "New Record",
  creatable: false,
  seed: [],
  kpis: [
    { label: "Total", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Active", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Pending", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Attention", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "key", header: "Key", render: (r) => <span className="font-mono text-[12px]">{r.key || "—"}</span> },
    { key: "label", header: "Label", render: (r) => <div className="font-semibold text-[13px]">{r.label || "—"}</div> },
    { key: "description", header: "Description" },
    { key: "value", header: "Value" },
    { key: "updated_at", header: "Updated" },
  ],
  filters: [

  ],
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
    { key: "label", label: "Label", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "value", label: "Value", type: "text" },
  ],
  searchFields: ["key", "label"],
  primaryField: "label",
};
