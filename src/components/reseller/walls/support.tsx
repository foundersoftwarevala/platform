import { Headphones, CheckCircle2, XCircle, Trash2, Clock, MessageSquare, User } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";


const STATUSES = ["open", "pending", "resolved", "cancelled"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const config: WallConfig = {
  scope: "support", entity: "ticket", route: "/support",
  eyebrow: "Ops", title: "Support Wall",
  subtitle: "Every ticket, assignment and SLA — one queue for the entire reseller network.",
  icon: Headphones, primaryLabel: "New Ticket",
  seed: [
    { id: "T-1", subject: "License key not activating", requester: "Ravi Kumar", reseller: "Acme Digital", priority: "high", status: "open", assignee: "Ops · Priya", created_at: "2026-07-09" },
    { id: "T-2", subject: "Refund request for ORD-8821", requester: "Neo Textiles", reseller: "PixelForge", priority: "medium", status: "pending", assignee: "Finance · Rahul", created_at: "2026-07-08" },
    { id: "T-3", subject: "Cannot access reseller portal", requester: "Nova Retail", reseller: "Nova Retail", priority: "critical", status: "open", assignee: "Eng · Ananya", created_at: "2026-07-09" },
    { id: "T-4", subject: "KYC document reupload", requester: "Bright Retail", reseller: "Bright Retail", priority: "low", status: "resolved", assignee: "Ops · Priya", created_at: "2026-07-04" },
  ],
  columns: [
    { key: "subject", header: "Subject", render: (r) => <div className="font-semibold text-[13px]">{r.subject}</div> },
    { key: "requester", header: "Requester" },
    { key: "reseller", header: "Reseller" },
    { key: "assignee", header: "Assignee" },
    { key: "priority", header: "Priority", render: (r) => <StatusPill value={r.priority} /> },
    { key: "created_at", header: "Opened" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "priority", label: "Priority", options: PRIORITIES },
  ],
  kpis: [
    { label: "Open", icon: Clock, compute: (r) => r.filter((x) => x.status === "open").length },
    { label: "Pending", icon: MessageSquare, compute: (r) => r.filter((x) => x.status === "pending").length },
    { label: "Resolved", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "resolved").length },
    { label: "Critical", icon: XCircle, compute: (r) => r.filter((x) => x.priority === "critical" && x.status !== "resolved").length },
  ],
  bulkActions: [
    { key: "resolve", label: "Resolve", icon: CheckCircle2, patch: { status: "resolved" } },
    { key: "pending", label: "Mark Pending", icon: Clock, patch: { status: "pending" } },
    { key: "cancel", label: "Cancel", icon: XCircle, patch: { status: "cancelled" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "resolve", label: "Resolve", icon: CheckCircle2, patch: { status: "resolved" } },
    { key: "reopen", label: "Reopen", icon: Clock, patch: { status: "open" } },
    { key: "assign_me", label: "Assign to me", icon: User, patch: { assignee: "Boss" } },
  ],
  formFields: [
    { key: "subject", label: "Subject", type: "text", required: true },
    { key: "requester", label: "Requester", type: "text", required: true },
    { key: "reseller", label: "Reseller", type: "text" },
    { key: "assignee", label: "Assignee", type: "text" },
    { key: "priority", label: "Priority", type: "select", options: PRIORITIES, defaultValue: "medium" },
    { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "open" },
  ],
  searchFields: ["subject", "requester", "reseller", "assignee"],
  primaryField: "subject", subField: "requester",
};
