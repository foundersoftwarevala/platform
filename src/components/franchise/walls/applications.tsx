import { ClipboardCheck, Activity, Coins, Gauge, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["active", "pending", "review", "suspended", "closed"] as const;

export const config: WallConfig = {
  scope: "franchise-applications",
  entity: "application",
  eyebrow: "Applications",
  title: "Franchise Applications",
  subtitle: "Review, verify and approve incoming applications with a full audit trail.",
  icon: ClipboardCheck,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "New", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Under Review", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "KYC Pending", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Signature", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Approved", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Rejected", icon: Activity, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "app_id", header: "App ID" },
    { key: "applicant", header: "Applicant" },
    { key: "location", header: "Location" },
    { key: "stage", header: "Stage", render: (r) => <StatusPill value={r.stage} /> },
    { key: "reviewer", header: "Reviewer" },
    { key: "kyc", header: "KYC", render: (r) => <StatusPill value={r.kyc} /> },
    { key: "payment", header: "Payment", render: (r) => <StatusPill value={r.payment} /> },
    { key: "submitted", header: "Submitted" },
  ],
  filters: [{ key: "status", label: "Status", options: STATUSES }],
  bulkActions: [],
  rowActions: [],
  formFields: [
    { key: "app_id", label: "App ID", type: "text", required: true },
    { key: "applicant", label: "Applicant", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "stage", label: "Stage", type: "text" },
    { key: "reviewer", label: "Reviewer", type: "text" },
    { key: "kyc", label: "KYC", type: "text" },
    { key: "payment", label: "Payment", type: "text" },
    { key: "submitted", label: "Submitted", type: "text" },
  ],
  searchFields: ["app_id", "applicant", "location"],
  primaryField: "app_id",
  panels: [{ title: "Workflow Pipeline", items: ["Live source pending", "Owner", "Last sync"] }, { title: "Applications", items: ["Live source pending", "Owner", "Last sync"] }],
};
