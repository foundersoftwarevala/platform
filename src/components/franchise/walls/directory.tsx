import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Store, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  // Reads and writes the franchises table. The wall is unchanged; the three
  // columns it names differently are translated by the endpoint.
  resource: "franchises",
  scope: "franchise-directory",
  entity: "directory",
  eyebrow: "Directory",
  title: "Franchise Master Directory",
  subtitle: "Single source of truth for every franchise globally, with health, risk and revenue at a glance.",
  icon: Store,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Total Franchises", icon: Gauge, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", icon: TrendingUp, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Suspended", icon: Coins, compute: (r) => (r.length ? r.filter((x) => x.status === "suspended").length : "—") },
    { label: "Countries", icon: ShieldCheck, compute: (r) => (r.length ? new Set(r.map((x) => x.country).filter(Boolean)).size : "—") },
    {
      label: "Avg Health Score", icon: Users,
      compute: (r) => {
        const scored = r.filter((x) => x.health != null);
        return scored.length ? Math.round(scored.reduce((s, x) => s + Number(x.health), 0) / scored.length) : "—";
      },
    },
    {
      label: "Avg Commission %", icon: Activity,
      compute: (r) => {
        const rated = r.filter((x) => x.commission != null);
        return rated.length ? `${(rated.reduce((s, x) => s + Number(x.commission), 0) / rated.length).toFixed(1)}%` : "—";
      },
    },
  ],
  columns: [
    { key: "code", header: "Code" },
    { key: "franchise", header: "Franchise" },
    {
      key: "location", header: "Location",
      render: (r) => [r.city, r.state, r.country].filter(Boolean).join(", ") || "—",
    },
    { key: "tier", header: "Tier", render: (r) => <StatusPill value={r.tier} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "commission", header: "Commission" },
    { key: "licenses", header: "Licenses" },
    { key: "revenue_mtd", header: "Revenue MTD" },
    { key: "health", header: "Health" },
    { key: "risk", header: "Risk", render: (r) => <StatusPill value={r.risk} /> },
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
    { key: "code", label: "Code", type: "text", required: true },
    { key: "franchise", label: "Franchise", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "tier", label: "Tier", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
    { key: "commission", label: "Commission", type: "text" },
    { key: "licenses", label: "Licenses", type: "text" },
    { key: "revenue_mtd", label: "Revenue MTD", type: "text" },
    { key: "health", label: "Health", type: "text" },
    { key: "risk", label: "Risk", type: "text" },
  ],
  searchFields: ["code", "franchise", "location"],
  primaryField: "code",
  panels: [{ title: "Directory", items: ["Live source pending", "Owner", "Last sync"] }],
};
