import { KeyRound, CheckCircle2, XCircle, Pause, Play, RotateCcw, Trash2, Clock, ShieldCheck } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["active", "expired", "paused", "pending"] as const;
const PLANS = ["basic", "pro", "enterprise"] as const;

export const config: WallConfig = {
  scope: "licenses", entity: "license", route: "/licenses",
  eyebrow: "Catalog", title: "Licenses Wall",
  subtitle: "Every provisioned license key across the network — status, expiry and reseller ownership.",
  icon: KeyRound, primaryLabel: "New License",
  seed: [
    { id: "L-1", key: "SV-PRO-8F3K-9421", product: "Software Vala Pro", plan: "pro", status: "active", reseller: "Acme Digital", customer: "Ravi Kumar", expires_at: "2026-12-31", created_at: "2026-06-10" },
    { id: "L-2", key: "SV-ENT-7A2X-1102", product: "Software Vala Enterprise", plan: "enterprise", status: "active", reseller: "PixelForge", customer: "Neo Textiles", expires_at: "2027-03-15", created_at: "2026-05-02" },
    { id: "L-3", key: "SV-BSC-3M9Q-4471", product: "Software Vala Basic", plan: "basic", status: "expired", reseller: "Acme Digital", customer: "Priya S.", expires_at: "2026-05-01", created_at: "2025-05-01" },
    { id: "L-4", key: "SV-PRO-2K7Y-8865", product: "Software Vala Pro", plan: "pro", status: "paused", reseller: "Nova Retail", customer: "Anish Traders", expires_at: "2026-11-20", created_at: "2026-04-18" },
  ],
  columns: [
    { key: "key", header: "License Key", render: (r) => <span className="font-mono text-[12px] font-semibold">{r.key}</span> },
    { key: "product", header: "Product" },
    { key: "plan", header: "Plan", render: (r) => <StatusPill value={r.plan} /> },
    { key: "customer", header: "Customer" },
    { key: "reseller", header: "Reseller" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "expires_at", header: "Expires", render: (r) => new Date(r.expires_at).toLocaleDateString() },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "plan", label: "Plan", options: PLANS },
  ],
  kpis: [
    { label: "Total Licenses", icon: KeyRound, compute: (r) => r.length },
    { label: "Active", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "active").length },
    { label: "Expired", icon: Clock, compute: (r) => r.filter((x) => x.status === "expired").length },
    { label: "Paused", icon: Pause, compute: (r) => r.filter((x) => x.status === "paused").length },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "renew", label: "Renew", icon: RotateCcw, patch: { status: "active" } },
    { key: "revoke", label: "Revoke", icon: XCircle, patch: { status: "expired" }, variant: "destructive", confirmTitle: "Revoke licenses?", confirmDescription: "Selected licenses will be revoked immediately." },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: Play, patch: { status: "active" } },
    { key: "pause", label: "Pause", icon: Pause, patch: { status: "paused" } },
    { key: "renew", label: "Renew", icon: RotateCcw, patch: { status: "active" } },
    { key: "revoke", label: "Revoke", icon: ShieldCheck, patch: { status: "expired" }, destructive: true },
  ],
  formFields: [
    { key: "key", label: "License Key", type: "text", required: true, placeholder: "SV-PRO-XXXX-XXXX" },
    { key: "product", label: "Product", type: "text", required: true },
    { key: "plan", label: "Plan", type: "select", options: PLANS, required: true, defaultValue: "pro" },
    { key: "customer", label: "Customer", type: "text", required: true },
    { key: "reseller", label: "Reseller", type: "text" },
    { key: "expires_at", label: "Expires On", type: "text", placeholder: "YYYY-MM-DD" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "active" },
  ],
  searchFields: ["key", "product", "customer", "reseller"],
  primaryField: "key", subField: "product",
  statusField: "status",
};
