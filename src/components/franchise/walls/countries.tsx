import { Activity, CheckCircle2, Coins, Flag, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "suspended", "closed"] as const;

export const config: WallConfig = {
  // Reads the franchises table, which is where a country is recorded.
  resource: "franchises",
  scope: "franchise-countries",
  entity: "countrie",
  eyebrow: "Countries",
  title: "Country Management",
  subtitle: "Define operating countries, market sizing, expansion plans and currency rules.",
  icon: Flag,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Active Countries", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Planned", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Total Population (Reach)", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Coverage %", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "country", header: "Country", render: (r) => <div className="font-semibold text-[13px]">{r.country || "—"}</div> },
    { key: "franchise", header: "Franchise" },
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-[12px]">{r.code || "—"}</span> },
    { key: "state", header: "State" },
    { key: "city", header: "City" },
    { key: "revenue_mtd", header: "Revenue", align: "right" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
  ],
  bulkActions: [
    { key: "active", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspended", label: "Suspend", icon: Pause, patch: { status: "suspended" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "active", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspended", label: "Suspend", icon: Pause, patch: { status: "suspended" }, destructive: true },
  ],
  formFields: [
    { key: "country", label: "Country", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "city", label: "City", type: "text" },
  ],
  searchFields: ["code", "franchise", "country"],
  primaryField: "country",
  panels: [{ title: "Countries", items: ["Owner", "Last sync"] }],
};
