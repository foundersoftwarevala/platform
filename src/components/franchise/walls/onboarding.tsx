import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Trash2, TrendingUp, UserPlus, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["pending", "approved", "rejected", "clarification"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_applications - the partners asking to join.
  resource: "franchise_applications",
  scope: "franchise-onboarding",
  entity: "onboarding",
  eyebrow: "Onboarding",
  title: "Franchise Onboarding",
  subtitle: "Standardised onboarding journey from signed agreement to go-live.",
  icon: UserPlus,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "In Onboarding", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Payment", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Training", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Go-Live This Week", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Avg. Time to Go-Live", icon: Users, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-[12px]">{r.code || "—"}</span> },
    { key: "business_name", header: "Business", render: (r) => <div className="font-semibold text-[13px]">{r.business_name || "—"}</div> },
    { key: "owner_name", header: "Owner" },
    { key: "email", header: "Email" },
    { key: "requested_territory", header: "Territory" },
    { key: "kyc_status", header: "KYC", render: (r) => <StatusPill value={r.kyc_status} /> },
    { key: "applied_at", header: "Applied" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
  ],
  bulkActions: [
    { key: "approved", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "rejected", label: "Reject", icon: Pause, patch: { status: "rejected" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "approved", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "rejected", label: "Reject", icon: Pause, patch: { status: "rejected" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "kyc_status", label: "KYC", type: "text" },
    { key: "requested_territory", label: "Territory", type: "text" },
    { key: "review_notes", label: "Review notes", type: "textarea" },
  ],
  searchFields: ["code", "business_name", "owner_name", "email", "status"],
  primaryField: "business_name",
  panels: [{ title: "Standard Journey", items: ["Owner", "Last sync"] }, { title: "Active Onboardings", items: ["Live source pending", "Owner", "Last sync"] }],
};
