import { FileBarChart, Download, Calendar, Play, Pause, Trash2, CheckCircle2 } from "lucide-react";

import { toast } from "sonner";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["scheduled", "active", "paused", "failed"] as const;
const CADENCES = ["daily", "weekly", "monthly", "quarterly"] as const;
const FORMATS = ["csv", "xlsx", "pdf"] as const;

export const config: WallConfig = {
  scope: "reports", entity: "report", route: "/reports",
  eyebrow: "Insights", title: "Reports Wall",
  subtitle: "Scheduled exports and analytical reports delivered to your inbox.",
  icon: FileBarChart, primaryLabel: "New Report",
  seed: [
    { id: "R-1", name: "Monthly Reseller Revenue", cadence: "monthly", format: "xlsx", recipient: "boss@softwarevala.com", status: "active", last_run: "2026-07-01", created_at: "2026-01-01" },
    { id: "R-2", name: "Weekly Order Pipeline", cadence: "weekly", format: "csv", recipient: "ops@softwarevala.com", status: "active", last_run: "2026-07-07", created_at: "2026-02-14" },
    { id: "R-3", name: "Quarterly Commission Ledger", cadence: "quarterly", format: "pdf", recipient: "finance@softwarevala.com", status: "scheduled", last_run: "—", created_at: "2026-06-01" },
    { id: "R-4", name: "Daily KYC Digest", cadence: "daily", format: "csv", recipient: "compliance@softwarevala.com", status: "paused", last_run: "2026-06-25", created_at: "2026-03-10" },
  ],
  columns: [
    { key: "name", header: "Report", render: (r) => <div className="font-semibold text-[13px]">{r.name}</div> },
    { key: "cadence", header: "Cadence", render: (r) => <StatusPill value={r.cadence} /> },
    { key: "format", header: "Format", render: (r) => <StatusPill value={r.format} /> },
    { key: "recipient", header: "Recipient" },
    { key: "last_run", header: "Last Run" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "cadence", label: "Cadence", options: CADENCES },
    { key: "format", label: "Format", options: FORMATS },
  ],
  kpis: [
    { label: "Active", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "active").length },
    { label: "Scheduled", icon: Calendar, compute: (r) => r.filter((x) => x.status === "scheduled").length },
    { label: "Paused", icon: Pause, compute: (r) => r.filter((x) => x.status === "paused").length },
    { label: "Total", icon: FileBarChart, compute: (r) => r.length },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "run_now", label: "Run now", icon: Download, patch: { last_run: new Date().toISOString().slice(0, 10) } },
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
  ],
  formFields: [
    { key: "name", label: "Report Name", type: "text", required: true },
    { key: "cadence", label: "Cadence", type: "select", options: CADENCES, required: true, defaultValue: "weekly" },
    { key: "format", label: "Format", type: "select", options: FORMATS, defaultValue: "csv" },
    { key: "recipient", label: "Recipient email", type: "email", required: true },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "scheduled" },
  ],
  searchFields: ["name", "recipient", "cadence"],
  primaryField: "name", subField: "recipient",
  renderDetail: (r) => (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery</div>
      <p className="mt-2 text-[13px]">Delivered as <span className="font-semibold uppercase">{r.format}</span> to <span className="font-semibold">{r.recipient}</span>.</p>
      <button
        onClick={() => toast.success(`Manual export queued for ${r.name}`)}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 text-[12px] font-semibold transition hover:border-accent/40 hover:text-accent"
      >
        <Download className="h-3.5 w-3.5" /> Export now
      </button>
    </>
  ),
};
