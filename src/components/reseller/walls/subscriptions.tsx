import { Repeat, CheckCircle2, Pause, Play, XCircle, Trash2, Clock, RotateCcw } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["active", "paused", "cancelled", "pending"] as const;
const CYCLES = ["monthly", "quarterly", "yearly"] as const;

export const config: WallConfig = {
  scope: "subscriptions", entity: "subscription", route: "/subscriptions",
  eyebrow: "Catalog", title: "Subscriptions Wall",
  subtitle: "Recurring plans across every reseller — active, paused, cancelled and renewal cycles.",
  icon: Repeat, primaryLabel: "New Subscription",
  seed: [
    { id: "S-1", plan: "Software Vala Pro", customer: "Ravi Kumar", reseller: "Acme Digital", cycle: "monthly", amount: 999, status: "active", next_renewal: "2026-08-10", created_at: "2026-01-10" },
    { id: "S-2", plan: "Software Vala Enterprise", customer: "Neo Textiles", reseller: "PixelForge", cycle: "yearly", amount: 24000, status: "active", next_renewal: "2027-03-15", created_at: "2026-03-15" },
    { id: "S-3", plan: "Software Vala Basic", customer: "Priya S.", reseller: "Acme Digital", cycle: "monthly", amount: 299, status: "paused", next_renewal: "—", created_at: "2026-02-04" },
  ],
  columns: [
    { key: "plan", header: "Plan", render: (r) => <div className="font-semibold text-[13px]">{r.plan}</div> },
    { key: "customer", header: "Customer" },
    { key: "reseller", header: "Reseller" },
    { key: "cycle", header: "Cycle", render: (r) => <StatusPill value={r.cycle} /> },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold">₹{Number(r.amount).toLocaleString()}</span> },
    { key: "next_renewal", header: "Next Renewal" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "cycle", label: "Cycle", options: CYCLES },
  ],
  kpis: [
    { label: "Total Subs", icon: Repeat, compute: (r) => r.length },
    { label: "Active", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "active").length },
    { label: "MRR (₹)", icon: RotateCcw, compute: (r) => `₹${r.filter((x) => x.status === "active").reduce((s, x) => s + (x.cycle === "monthly" ? x.amount : x.cycle === "yearly" ? x.amount / 12 : x.amount / 3), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    { label: "Paused", icon: Pause, compute: (r) => r.filter((x) => x.status === "paused").length },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "cancel", label: "Cancel", icon: XCircle, patch: { status: "cancelled" }, variant: "destructive", confirmTitle: "Cancel subscriptions?" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "cancel", label: "Cancel", icon: XCircle, patch: { status: "cancelled" }, destructive: true },
  ],
  formFields: [
    { key: "plan", label: "Plan Name", type: "text", required: true },
    { key: "customer", label: "Customer", type: "text", required: true },
    { key: "reseller", label: "Reseller", type: "text" },
    { key: "cycle", label: "Cycle", type: "select", options: CYCLES, required: true, defaultValue: "monthly" },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "next_renewal", label: "Next Renewal", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
  ],
  searchFields: ["plan", "customer", "reseller"],
  primaryField: "plan", subField: "customer",
};
