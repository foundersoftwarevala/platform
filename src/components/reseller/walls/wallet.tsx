import { Wallet, ArrowUpCircle, CheckCircle2, XCircle, Coins, Clock, Undo2 } from "lucide-react";

import { StatusPill, type WallConfig, type WallRow } from "@/components/manager-suite/wall";
import { setResellerPayoutStatus } from "@/lib/marketplace-manager/resellers.functions";

// The table's own vocabulary (reseller_payouts_status_check).
const STATUSES = ["pending", "approved", "processing", "paid", "failed", "reversed", "cancelled"] as const;
const CURRENCIES = ["INR", "USD"] as const;

type PayoutTarget = "approved" | "processing" | "paid" | "failed" | "reversed";

/**
 * Every decision on a payout goes through mm_reseller_payout_status, the same
 * function the reseller console uses. It holds the allowed transitions, will
 * not record a payout as paid without the provider's reference or as failed
 * or reversed without a reason, settles or releases the commission lines,
 * writes the ledger and tells the reseller. Patching the status column did
 * none of that, and the endpoint no longer accepts it.
 */
const move = (to: PayoutTarget) => async (row: WallRow, answer?: string) =>
  setResellerPayoutStatus({
    data: {
      id: row.id,
      status: to,
      ...(to === "paid" ? { reference: answer } : {}),
      ...(to === "failed" || to === "reversed" ? { reason: answer } : {}),
    },
  });

const is = (...statuses: string[]) => (row: WallRow) => statuses.includes(String(row.status));

/** A sum per currency, because rupees and dollars do not add up. */
const byCurrency = (rows: WallRow[]) => {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(String(r.currency ?? ""), (totals.get(String(r.currency ?? "")) ?? 0) + Number(r.amount ?? 0));
  return [...totals].map(([c, v]) => `${c} ${v.toLocaleString()}`.trim()).join(" · ");
};

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
      label: "Paid Out", hint: "Paid payouts", icon: Coins,
      compute: (r) => {
        const done = r.filter((x) => x.status === "paid");
        return done.length ? byCurrency(done) : "—";
      },
    },
    {
      label: "Awaiting", hint: "Pending or approved", icon: Clock,
      compute: (r) => (r.length ? r.filter((x) => x.status === "pending" || x.status === "approved").length : "—"),
    },
    { label: "In Flight", hint: "Being processed", icon: ArrowUpCircle, compute: (r) => (r.length ? r.filter((x) => x.status === "processing").length : "—") },
    { label: "Failed", icon: XCircle, compute: (r) => (r.length ? r.filter((x) => x.status === "failed").length : "—") },
  ],
  bulkActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, when: is("pending"), run: move("approved") },
    {
      key: "fail", label: "Mark Failed", icon: XCircle, variant: "destructive",
      when: is("pending", "approved", "processing"), run: move("failed"),
      ask: "Why did these payouts fail? The reseller is still owed the money; the reason is recorded and sent to them.",
      confirmTitle: "Mark these payouts failed?", confirmDescription: "The reseller is still owed the money; only the attempt is recorded as failed.",
    },
  ],
  rowActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, when: is("pending"), run: move("approved") },
    { key: "process", label: "Mark Processing", icon: ArrowUpCircle, when: is("approved"), run: move("processing") },
    {
      key: "complete", label: "Mark Paid", icon: Coins, when: is("processing"), run: move("paid"),
      ask: "Provider transaction reference (bank or payout provider). A payout is recorded as paid only with it.",
    },
    {
      key: "fail", label: "Mark Failed", icon: XCircle, destructive: true,
      when: is("pending", "approved", "processing"), run: move("failed"),
      ask: "Why did this payout fail?",
    },
    {
      key: "reverse", label: "Reverse", icon: Undo2, destructive: true, when: is("paid"), run: move("reversed"),
      ask: "Why is this payout being reversed? The commission returns to the queue and the ledger keeps a counter-entry.",
    },
  ],
  // Status, reference and failure reason are set by the actions above, which
  // carry their own rules; only the method is a plain field.
  formFields: [
    { key: "payment_method", label: "Method", type: "text" },
  ],
  searchFields: ["status", "currency", "provider_reference"],
  primaryField: "provider_reference", subField: "status",
  statusField: "status",
};
