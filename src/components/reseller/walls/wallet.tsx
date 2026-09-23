import { Wallet, ArrowUpCircle, CheckCircle2, XCircle, Coins, Clock } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const STATUSES = ["requested", "approved", "processing", "completed", "failed"] as const;
const CURRENCIES = ["INR", "USD"] as const;

/**
 * Payouts, read and written on reseller_payouts.
 *
 * The wall used to show four invented transactions in one operator's browser.
 * What it shows now is money the platform actually owes and has paid. An
 * amount is never typed in here: a payout is raised by the flow that earned
 * it, and this screen only carries the decision on it.
 */
export const config: WallConfig = {
  resource: "reseller_payouts",
  creatable: false,
  scope: "wallet", entity: "payout", route: "/wallet",
  eyebrow: "Commerce", title: "Payouts Wall",
  subtitle: "Every payout owed to a reseller — requested, approved, paid or failed.",
  icon: Wallet, primaryLabel: "New Payout",
  seed: [],
  columns: [
    {
      key: "reseller_id", header: "Reseller",
      render: (r) => <span className="font-mono text-[11px]">{String(r.reseller_id ?? "—").slice(0, 8)}</span>,
    },
    {
      key: "amount", header: "Amount", align: "right",
      render: (r) => <span className="font-semibold">{r.currency ?? ""} {Number(r.amount ?? 0).toLocaleString()}</span>,
    },
    { key: "payment_method", header: "Method", render: (r) => <span>{r.payment_method ?? "—"}</span> },
    {
      key: "provider_reference", header: "Reference",
      render: (r) => <span className="font-mono text-[12px]">{r.provider_reference ?? "—"}</span>,
    },
    { key: "requested_at", header: "Requested" },
    { key: "completed_at", header: "Completed" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "currency", label: "Currency", options: CURRENCIES },
  ],
  kpis: [
    {
      label: "Paid Out", hint: "Completed payouts", icon: Coins,
      compute: (r) => {
        const done = r.filter((x) => x.status === "completed");
        return done.length ? done.reduce((s, x) => s + Number(x.amount ?? 0), 0).toLocaleString() : "—";
      },
    },
    {
      label: "Awaiting", hint: "Requested or approved", icon: Clock,
      compute: (r) => (r.length ? r.filter((x) => x.status === "requested" || x.status === "approved").length : "—"),
    },
    { label: "In Flight", hint: "Being processed", icon: ArrowUpCircle, compute: (r) => (r.length ? r.filter((x) => x.status === "processing").length : "—") },
    { label: "Failed", icon: XCircle, compute: (r) => (r.length ? r.filter((x) => x.status === "failed").length : "—") },
  ],
  bulkActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "fail", label: "Mark Failed", icon: XCircle, patch: { status: "failed" }, variant: "destructive", confirmTitle: "Mark these payouts failed?", confirmDescription: "The reseller is still owed the money; only the attempt is recorded as failed." },
  ],
  rowActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "process", label: "Mark Processing", icon: ArrowUpCircle, patch: { status: "processing" } },
    { key: "complete", label: "Mark Paid", icon: Coins, patch: { status: "completed" } },
    { key: "fail", label: "Mark Failed", icon: XCircle, patch: { status: "failed" }, destructive: true },
  ],
  formFields: [
    { key: "status", label: "Status", type: "select", options: STATUSES },
    { key: "payment_method", label: "Method", type: "text" },
    { key: "failure_reason", label: "Failure reason", type: "textarea" },
  ],
  searchFields: ["status", "currency", "provider_reference"],
  primaryField: "provider_reference", subField: "status",
  statusField: "status",
};
