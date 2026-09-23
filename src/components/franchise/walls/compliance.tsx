import { Activity, CheckCircle2, Coins, Gauge, Pause, Scale, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["pending", "in_progress", "met", "breached"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_compliance.
  resource: "franchise_compliance",
  scope: "franchise-compliance",
  entity: "compliance",
  eyebrow: "Compliance",
  title: "Compliance & Risk",
  subtitle: "KYC, tax, business licensing, audits and risk monitoring.",
  icon: Scale,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "KYC Verified", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "KYC Pending", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Documents Expiring", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Compliance Alerts", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg. Risk Score", icon: Users, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "requirement", header: "Requirement", render: (r) => <div className="font-semibold text-[13px]">{r.requirement || "—"}</div> },
    { key: "category", header: "Category" },
    { key: "severity", header: "Severity", render: (r) => <StatusPill value={r.severity} /> },
    { key: "due_date", header: "Due" },
    { key: "last_checked", header: "Last checked" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
  ],
  bulkActions: [
    { key: "met", label: "Mark Met", icon: CheckCircle2, patch: { status: "met" } },
    { key: "breached", label: "Mark Breached", icon: Pause, patch: { status: "breached" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "met", label: "Mark Met", icon: CheckCircle2, patch: { status: "met" } },
    { key: "breached", label: "Mark Breached", icon: Pause, patch: { status: "breached" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "severity", label: "Severity", type: "text" },
    { key: "due_date", label: "Due date", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  searchFields: ["requirement", "category", "status"],
  primaryField: "requirement",
  panels: [{ title: "Compliance Register", items: ["Owner", "Last sync"] }],
};
