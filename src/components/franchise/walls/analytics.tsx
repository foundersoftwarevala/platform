import { Activity, BarChart3, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  // Reads franchise_performance.
  resource: "franchise_performance",
  scope: "franchise-analytics",
  entity: "analytic",
  eyebrow: "Analytics",
  title: "Franchise Analytics",
  subtitle: "Deep analytics across every operational and financial dimension.",
  icon: BarChart3,
  primaryLabel: "New Record",
  creatable: false,
  seed: [],
  kpis: [
    { label: "MAU", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Revenue / Franchise", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Retention", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Forecast Accuracy", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "period", header: "Period", render: (r) => <div className="font-semibold text-[13px]">{r.period || "—"}</div> },
    { key: "revenue", header: "Revenue", align: "right", render: (r) => <span className="font-semibold">{r.revenue ? `₹${Number(r.revenue).toLocaleString()}` : "—"}</span> },
    { key: "leads", header: "Leads", align: "right" },
    { key: "conversions", header: "Conversions", align: "right" },
    { key: "tickets", header: "Tickets", align: "right" },
    { key: "csat", header: "CSAT", align: "right" },
    { key: "sla_percent", header: "SLA %", align: "right" },
  ],
  filters: [
    { key: "period", label: "Period", options: STATUSES },
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

  ],
  searchFields: ["period"],
  primaryField: "period",
  panels: [{ title: "Analytics Panels", items: ["Owner", "Last sync"] }],
};
