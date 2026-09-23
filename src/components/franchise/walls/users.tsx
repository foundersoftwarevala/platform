import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "inactive", "suspended"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_employees.
  resource: "franchise_employees",
  scope: "franchise-users",
  entity: "user",
  eyebrow: "Users",
  title: "User & Role Management",
  subtitle: "Owners, managers, sales, support, finance, marketing \u2014 across every franchise.",
  icon: Users,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "Total Users", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Active Today", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Locked", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Pending Invitations", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "full_name", header: "Employee", render: (r) => <div className="font-semibold text-[13px]">{r.full_name || "—"}</div> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    { key: "performance", header: "Performance", align: "right" },
    { key: "availability", header: "Availability" },
    { key: "joined_at", header: "Joined" },
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
    { key: "full_name", label: "Full name", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "role", label: "Role", type: "text" },
    { key: "status", label: "Status", type: "select", options: STATUSES },
  ],
  searchFields: ["full_name", "email", "role", "status"],
  primaryField: "full_name",
  panels: [{ title: "Roles", items: ["Owner", "Last sync"] }, { title: "All Users", items: ["Live source pending", "Owner", "Last sync"] }],
};
