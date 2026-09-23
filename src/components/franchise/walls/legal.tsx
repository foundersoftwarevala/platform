import { Activity, CheckCircle2, Coins, Gauge, Pause, Scale, ShieldCheck, Trash2, TrendingUp, Users } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["draft", "active", "expired", "terminated"] as const;

export const config: WallConfig = {
  // Reads and writes franchise_contracts.
  resource: "franchise_contracts",
  scope: "franchise-legal",
  entity: "legal",
  eyebrow: "Legal",
  title: "Legal & Agreements",
  subtitle: "Master franchise agreements, NDAs, policies and digital signatures.",
  icon: Scale,
  primaryLabel: "New Record",
  creatable: false,
  seed: [],
  kpis: [
    { label: "Agreements Active", icon: Gauge, compute: (r) => r.length ? r.length : "—" },
    { label: "Awaiting Signature", icon: TrendingUp, compute: (r) => r.length ? r.length : "—" },
    { label: "Expiring < 90d", icon: Coins, compute: (r) => r.length ? r.length : "—" },
    { label: "Disputes Open", icon: ShieldCheck, compute: (r) => r.length ? r.length : "—" },
  ],
  columns: [
    { key: "contract_no", header: "Contract", render: (r) => <span className="font-mono text-[12px] font-semibold">{r.contract_no || "—"}</span> },
    { key: "contract_type", header: "Type" },
    { key: "start_date", header: "Start" },
    { key: "end_date", header: "End" },
    { key: "value", header: "Value", align: "right", render: (r) => <span className="font-semibold">{r.value ? `₹${Number(r.value).toLocaleString()}` : "—"}</span> },
    { key: "renewal_status", header: "Renewal", render: (r) => <StatusPill value={r.renewal_status} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
  ],
  bulkActions: [
    { key: "active", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "terminated", label: "Terminate", icon: Pause, patch: { status: "terminated" }, variant: "destructive" },
  ],
  rowActions: [
    { key: "active", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "terminated", label: "Terminate", icon: Pause, patch: { status: "terminated" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "renewal_status", label: "Renewal", type: "text" },
    { key: "end_date", label: "End date", type: "text", placeholder: "YYYY-MM-DD" },
  ],
  searchFields: ["contract_no", "contract_type", "status"],
  primaryField: "contract_no",
  panels: [{ title: "Document Types", items: ["Owner", "Last sync"] }, { title: "Legal Register", items: ["Live source pending", "Owner", "Last sync"] }],
};
