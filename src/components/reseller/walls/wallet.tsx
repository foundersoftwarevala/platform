import { Wallet, ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle, Trash2, Coins, Clock } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const TYPES = ["credit", "debit", "payout", "refund"] as const;
const STATUSES = ["pending", "processing", "paid", "failed"] as const;

export const config: WallConfig = {
  scope: "wallet", entity: "transaction", route: "/wallet",
  eyebrow: "Commerce", title: "Wallet Wall",
  subtitle: "Every reseller wallet movement — credits, debits, payouts and reconciliation.",
  icon: Wallet, primaryLabel: "New Transaction",
  seed: [
    { id: "W-1", reseller: "Acme Digital", type: "credit", amount: 12500, ref: "TOPUP-882", status: "paid", note: "Commission payout Q2", created_at: "2026-07-08" },
    { id: "W-2", reseller: "PixelForge", type: "debit", amount: 4500, ref: "ORDER-4419", status: "paid", note: "Order deduction", created_at: "2026-07-07" },
    { id: "W-3", reseller: "Nova Retail", type: "payout", amount: 8000, ref: "PAYOUT-119", status: "pending", note: "Manual payout request", created_at: "2026-07-06" },
    { id: "W-4", reseller: "Acme Digital", type: "refund", amount: 999, ref: "RFND-773", status: "processing", note: "Customer refund", created_at: "2026-07-05" },
  ],
  columns: [
    { key: "reseller", header: "Reseller", render: (r) => <div className="font-semibold">{r.reseller}</div> },
    { key: "type", header: "Type", render: (r) => <StatusPill value={r.type} /> },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className={`font-semibold ${r.type === "credit" ? "text-emerald-600 dark:text-emerald-400" : r.type === "debit" ? "text-rose-600 dark:text-rose-400" : ""}`}>₹{Number(r.amount).toLocaleString()}</span> },
    { key: "ref", header: "Reference", render: (r) => <span className="font-mono text-[12px]">{r.ref}</span> },
    { key: "note", header: "Note" },
    { key: "created_at", header: "Date" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "type", label: "Type", options: TYPES },
    { key: "status", label: "Status", options: STATUSES },
  ],
  kpis: [
    { label: "Balance (Total)", icon: Coins, compute: (r) => `₹${(r.filter((x) => x.type === "credit" && x.status === "paid").reduce((s, x) => s + x.amount, 0) - r.filter((x) => (x.type === "debit" || x.type === "payout") && x.status === "paid").reduce((s, x) => s + x.amount, 0)).toLocaleString()}` },
    { label: "Credits", icon: ArrowDownCircle, compute: (r) => r.filter((x) => x.type === "credit").length },
    { label: "Payouts", icon: ArrowUpCircle, compute: (r) => r.filter((x) => x.type === "payout").length },
    { label: "Pending", icon: Clock, compute: (r) => r.filter((x) => x.status === "pending" || x.status === "processing").length },
  ],
  bulkActions: [
    { key: "mark_paid", label: "Mark Paid", icon: CheckCircle2, patch: { status: "paid" } },
    { key: "fail", label: "Mark Failed", icon: XCircle, patch: { status: "failed" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "mark_paid", label: "Mark Paid", icon: CheckCircle2, patch: { status: "paid" } },
    { key: "fail", label: "Mark Failed", icon: XCircle, patch: { status: "failed" }, destructive: true },
  ],
  formFields: [
    { key: "reseller", label: "Reseller", type: "text", required: true },
    { key: "type", label: "Type", type: "select", options: TYPES, required: true, defaultValue: "credit" },
    { key: "amount", label: "Amount", type: "number", required: true },
    { key: "ref", label: "Reference", type: "text", placeholder: "TOPUP-…" },
    { key: "note", label: "Note", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "pending" },
  ],
  searchFields: ["reseller", "ref", "note"],
  primaryField: "ref", subField: "reseller",
};
