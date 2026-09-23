import { Activity, CheckCircle2, Coins, Gauge, Pause, ShieldCheck, Target, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_leads.
  resource: "franchise_leads",
  scope: "franchise-leads",
  entity: "lead",
  eyebrow: "Leads",
  title: "Franchise Leads",
  subtitle: "Inbound franchise enquiries, source attribution and conversion pipeline.",
  icon: Target,
  primaryLabel: "New Record",
  seed: [],
  kpis: [
    { label: "New Leads", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Qualified", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "In Discussion", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Converted", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
    { label: "Dropped", icon: Users, compute: (r) => r.length ? r.length : "—" },
    { label: "Conversion Rate", icon: Activity, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "name", header: "Lead", render: (r) => <div className="font-semibold text-[13px]">{r.name || "—"}</div> },
    { key: "company", header: "Company" },
    { key: "value", header: "Value", align: "right", render: (r) => <span className="font-semibold">{r.value ? `₹${Number(r.value).toLocaleString()}` : "—"}</span> },
    { key: "source", header: "Source" },
    { key: "created_at", header: "Received" },
    { key: "stage", header: "Stage", render: (r) => <StatusPill value={r.stage} /> },
  ],
  filters: [
    { key: "stage", label: "Stage", options: STATUSES },
  ],
  bulkActions: [
    { key: "qualified", label: "Qualify", icon: CheckCircle2, patch: { stage: "qualified" } },
    { key: "lost", label: "Mark Lost", icon: Pause, patch: { stage: "lost" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "qualified", label: "Qualify", icon: CheckCircle2, patch: { stage: "qualified" } },
    { key: "lost", label: "Mark Lost", icon: Pause, patch: { stage: "lost" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Lead name", type: "text", required: true },
    { key: "company", label: "Company", type: "text" },
    { key: "value", label: "Value", type: "number" },
    { key: "source", label: "Source", type: "text" },
    { key: "stage", label: "Stage", type: "select", options: STATUSES },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  searchFields: ["name", "company", "stage", "source"],
  primaryField: "name",
  statusField: "stage",
  panels: [{ title: "Pipeline", items: ["Owner", "Last sync"] }],
};
