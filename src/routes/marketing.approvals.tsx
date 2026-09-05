import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, ShieldQuestion, XCircle } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { StatusBadge } from "@/components/marketing/kit";
import { dateTime, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Review and clear pending campaign, creative, budget and content approvals with priority and approver tracking.",
      },
      { property: "og:title", content: "Approvals — Software Vala" },
      {
        property: "og:description",
        content: "Marketing approval queue with priorities, approvers and decision history.",
      },
    ],
  }),
  component: ApprovalsScreen,
});

const ITEM_TYPES = ["campaign", "creative", "budget", "content", "offer", "automation"] as const;
const STATUSES = ["pending", "in_review", "approved", "rejected"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function ApprovalsScreen() {
  return (
    <DataScreen
      table="marketing_approvals"
      title="Approvals"
      description="Approval queue across campaigns, creatives, budgets and content."
      module="Approvals"
      entityLabel="Approval"
      order={{ column: "requested_at" }}
      searchKeys={["item_name", "item_type", "requested_by", "approver"]}
      filterKey="status"
      filterOptions={STATUSES}
      minWidth={1080}
      stats={[
        { label: "Requests", icon: ShieldQuestion, tone: "violet", value: (r) => num(r.length) },
        {
          label: "Pending",
          icon: Clock,
          tone: "gold",
          value: (r) => num(r.filter((x) => x.status === "pending" || x.status === "in_review").length),
        },
        {
          label: "Approved",
          icon: CheckCircle2,
          tone: "green",
          value: (r) => num(r.filter((x) => x.status === "approved").length),
        },
        {
          label: "Rejected",
          icon: XCircle,
          tone: "rose",
          value: (r) => num(r.filter((x) => x.status === "rejected").length),
        },
      ]}
      columns={[
        {
          key: "item_name",
          header: "Item",
          render: (r) => <span className="font-medium">{r.item_name}</span>,
        },
        { key: "item_type", header: "Type", render: (r) => titleCase(r.item_type) },
        { key: "requested_by", header: "Requested by", render: (r) => r.requested_by },
        { key: "requested_at", header: "Requested", render: (r) => dateTime(r.requested_at) },
        { key: "priority", header: "Priority", render: (r) => <StatusBadge value={r.priority} /> },
        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
        { key: "approver", header: "Approver", render: (r) => r.approver ?? "—" },
        { key: "decided_at", header: "Decided", render: (r) => dateTime(r.decided_at) },
        { key: "notes", header: "Notes", render: (r) => r.notes ?? "—" },
      ]}
      fields={[
        { key: "item_name", label: "Item name", kind: "text", required: true, full: true },
        { key: "item_type", label: "Item type", kind: "select", options: ITEM_TYPES },
        { key: "status", label: "Status", kind: "select", options: STATUSES },
        { key: "priority", label: "Priority", kind: "select", options: PRIORITIES },
        { key: "requested_by", label: "Requested by", kind: "text", required: true },
        { key: "requested_at", label: "Requested at", kind: "datetime" },
        { key: "approver", label: "Approver", kind: "text" },
        { key: "decided_at", label: "Decided at", kind: "datetime" },
        { key: "notes", label: "Notes", kind: "textarea", full: true },
      ]}
    />
  );
}
