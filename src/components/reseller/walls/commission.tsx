import { Percent, FileText, Coins, Calendar, CheckCircle2, XCircle, Trash2, Pause, Play } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["active", "paused", "draft"] as const;
const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
const SCOPES = ["global", "product", "tier", "geo"] as const;

export const config: WallConfig = {
  scope: "commission", entity: "rule", route: "/commission",
  eyebrow: "Finance", title: "Commission Wall",
  subtitle: "Define rules, track earnings and run payout cycles by tier, product and geography.",
  icon: Percent, primaryLabel: "New Rule",
  seed: [
    { id: "C-1", name: "Gold tier — Pro plan", scope: "tier", tier: "gold", rate: 18, cycle: "monthly", status: "active", created_at: "2026-06-01" },
    { id: "C-2", name: "Enterprise product override", scope: "product", tier: "platinum", rate: 25, cycle: "quarterly", status: "active", created_at: "2026-05-10" },
    { id: "C-3", name: "Bronze intro", scope: "global", tier: "bronze", rate: 8, cycle: "monthly", status: "paused", created_at: "2026-03-15" },
    { id: "C-4", name: "APAC geo bonus", scope: "geo", tier: "silver", rate: 12, cycle: "monthly", status: "draft", created_at: "2026-07-01" },
  ],
  columns: [
    { key: "name", header: "Rule", render: (r) => <div className="font-semibold text-[13px]">{r.name}</div> },
    { key: "scope", header: "Scope", render: (r) => <StatusPill value={r.scope} /> },
    { key: "tier", header: "Tier", render: (r) => <StatusPill value={r.tier} /> },
    { key: "rate", header: "Rate", align: "right", render: (r) => <span className="font-semibold">{r.rate}%</span> },
    { key: "cycle", header: "Cycle", render: (r) => <StatusPill value={r.cycle} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "tier", label: "Tier", options: TIERS },
    { key: "scope", label: "Scope", options: SCOPES },
  ],
  kpis: [
    { label: "Active Rules", icon: FileText, compute: (r) => r.filter((x) => x.status === "active").length },
    { label: "Total Rules", icon: Percent, compute: (r) => r.length },
    { label: "Avg Rate", icon: Coins, compute: (r) => r.length ? `${(r.reduce((s, x) => s + x.rate, 0) / r.length).toFixed(1)}%` : "0%" },
    { label: "Draft", icon: Calendar, compute: (r) => r.filter((x) => x.status === "draft").length },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "archive", label: "Archive", icon: XCircle, patch: { status: "draft" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Rule Name", type: "text", required: true },
    { key: "scope", label: "Scope", type: "select", options: SCOPES, required: true, defaultValue: "tier" },
    { key: "tier", label: "Tier", type: "select", options: TIERS, defaultValue: "gold" },
    { key: "rate", label: "Rate (%)", type: "number", required: true, defaultValue: 10 },
    { key: "cycle", label: "Payout Cycle", type: "select", options: ["monthly", "quarterly", "yearly"], defaultValue: "monthly" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
  ],
  searchFields: ["name", "scope", "tier"],
  primaryField: "name", subField: "scope",
};
