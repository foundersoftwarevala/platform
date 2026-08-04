import { BadgeCheck, Clock, CheckCircle2, XCircle, ArrowUpRight, Trash2 } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["pending", "approved", "rejected"] as const;
const TYPES = ["kyc", "commission", "refund", "reseller", "license"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const config: WallConfig = {
  scope: "approvals", entity: "approval", route: "/approvals",
  eyebrow: "Governance", title: "Approvals Wall",
  subtitle: "Every privileged decision in one inbox — approve, reject or escalate with full audit.",
  icon: BadgeCheck, primaryLabel: "New Request",
  seed: [
    { id: "A-1", type: "kyc", subject: "Acme Digital — GST verification", requester: "system", priority: "high", status: "pending", created_at: "2026-07-09" },
    { id: "A-2", type: "commission", subject: "Q3 override — PixelForge", requester: "Ops", priority: "medium", status: "pending", created_at: "2026-07-08" },
    { id: "A-3", type: "refund", subject: "Refund ₹4,500 — Order ORD-882140", requester: "Support", priority: "high", status: "approved", created_at: "2026-07-07" },
    { id: "A-4", type: "reseller", subject: "New reseller sign-up — Bright Retail", requester: "system", priority: "low", status: "rejected", created_at: "2026-07-05" },
  ],
  columns: [
    { key: "subject", header: "Request", render: (r) => <div className="font-semibold text-[13px]">{r.subject}</div> },
    { key: "type", header: "Type", render: (r) => <StatusPill value={r.type} /> },
    { key: "requester", header: "Requester" },
    { key: "priority", header: "Priority", render: (r) => <StatusPill value={r.priority} /> },
    { key: "created_at", header: "Submitted" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "type", label: "Type", options: TYPES },
    { key: "priority", label: "Priority", options: PRIORITIES },
  ],
  kpis: [
    { label: "Pending", icon: Clock, compute: (r) => r.filter((x) => x.status === "pending").length },
    { label: "Approved", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "approved").length },
    { label: "Rejected", icon: XCircle, compute: (r) => r.filter((x) => x.status === "rejected").length },
    { label: "Total", icon: BadgeCheck, compute: (r) => r.length },
  ],
  bulkActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "reject", label: "Reject", icon: XCircle, patch: { status: "rejected" }, variant: "destructive", confirmTitle: "Reject requests?" },
    { key: "escalate", label: "Escalate", icon: ArrowUpRight, patch: { priority: "critical" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "approved" } },
    { key: "reject", label: "Reject", icon: XCircle, patch: { status: "rejected" }, destructive: true },
    { key: "escalate", label: "Escalate", icon: ArrowUpRight, patch: { priority: "critical" } },
  ],
  formFields: [
    { key: "type", label: "Request Type", type: "select", options: TYPES, required: true, defaultValue: "kyc" },
    { key: "subject", label: "Subject", type: "text", required: true, placeholder: "Describe the request" },
    { key: "requester", label: "Requester", type: "text", required: true },
    { key: "priority", label: "Priority", type: "select", options: PRIORITIES, defaultValue: "medium" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "pending" },
  ],
  searchFields: ["subject", "requester", "type"],
  primaryField: "subject", subField: "type",
};
