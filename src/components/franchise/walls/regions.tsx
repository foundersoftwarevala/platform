import { Globe2, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-regions",
  entity: "region",
  eyebrow: "Territory",
  title: "Region & Territory Management",
  subtitle: "Manage regions, states, cities, locks, transfers and expansion plans across the globe.",
  icon: Globe2,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Regions", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Countries", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "States", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Cities Assigned", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Locked", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Pending Transfers", icon: Activity, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "region", header: "Region" },
    { key: "country", header: "Country" },
    { key: "state", header: "State" },
    { key: "city", header: "City" },
    { key: "assigned_to", header: "Assigned To" },
    { key: "population", header: "Population" },
    { key: "market_size_usd", header: "Market Size (USD)" },
    { key: "lock", header: "Lock" },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  bulkActions: [],
  rowActions: [],
  formFields: [
    { key: "region", label: "Region", type: "text", required: true },
    { key: "country", label: "Country", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "city", label: "City", type: "text" },
    { key: "assigned_to", label: "Assigned To", type: "text" },
    { key: "population", label: "Population", type: "text" },
    { key: "market_size_usd", label: "Market Size (USD)", type: "text" },
    { key: "lock", label: "Lock", type: "text" },
  ],
  searchFields: ["region", "country", "state"],
  primaryField: "region",
  panels: [{ title: "Global Map", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Territories", items: ["Live source pending", "Owner", "Last sync"] }],
};
