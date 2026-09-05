import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import type { WallConfig } from "@/components/manager-suite/wall";
import { StatusPill } from "@/components/manager-suite/wall";

export const config: WallConfig = {
  scope: "membership-approvals",
  entity: "membership order",
  route: "/membership-approvals",
  eyebrow: "Finance Manager",
  title: "Reseller Membership Payments",
  subtitle: "Review server-priced reseller membership orders and verify payment evidence.",
  icon: FileText,
  primaryLabel: "",
  canCreate: false,
  seed: [],
  columns: [
    { key: "order_number", header: "Order", render: (row) => <span className="font-mono text-xs">{row.order_number || "-"}</span> },
    { key: "plan_id", header: "Plan", render: (row) => row.plan_id || "-" },
    { key: "proof_reference", header: "Reference", render: (row) => row.proof_reference || "-" },
    { key: "amount", header: "Amount", render: (row) => `$${Number(row.amount ?? 0).toFixed(2)} ${row.currency ?? "USD"}` },
    { key: "status", header: "Status", render: (row) => <StatusPill value={row.status} /> },
    { key: "created_at", header: "Created", render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : "-" },
  ],
  filters: [{ key: "status", label: "Status", options: ["pending", "processing", "paid", "failed", "cancelled", "refunded"] }],
  kpis: [
    { label: "Pending", icon: Clock, compute: (rows) => rows.filter((row) => row.status === "pending").length },
    { label: "Submitted", icon: FileText, compute: (rows) => rows.filter((row) => row.status === "processing").length },
    { label: "Paid", icon: CheckCircle2, compute: (rows) => rows.filter((row) => row.status === "paid").length },
    { label: "Failed", icon: XCircle, compute: (rows) => rows.filter((row) => row.status === "failed").length },
  ],
  bulkActions: [],
  rowActions: [
    { key: "verify", label: "Verify payment", icon: CheckCircle2, patch: { payment_status: "SUCCESS" } },
    { key: "reject", label: "Reject payment", icon: XCircle, patch: { payment_status: "FAILED" }, destructive: true, confirmTitle: "Reject this payment?" },
  ],
  formFields: [],
  searchFields: ["order_number", "proof_reference", "payment_status"],
  primaryField: "order_number",
};
