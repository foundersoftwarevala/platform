import { Headphones, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

/**
 * The reseller network's support queue.
 *
 * This wall showed four invented tickets kept in the browser. A reseller's
 * support requests are AMS tickets - the reseller dashboard's AMS desk raises
 * them - so it reads those (reseller_support_tickets, a view over ams_tickets).
 * It only reads: a ticket's status and history belong to the AMS Manager,
 * where it is worked, so each ticket links there.
 */

const STATUSES = [
  "submitted", "assigned", "accepted", "in_progress", "waiting_customer", "waiting_developer",
  "waiting_qa", "testing", "resolved", "closed", "reopened", "cancelled",
] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const OPEN = new Set(["submitted", "assigned", "accepted", "in_progress", "reopened", "testing"]);
const WAITING = new Set(["waiting_customer", "waiting_developer", "waiting_qa"]);

export const config: WallConfig = {
  resource: "reseller_support_tickets",
  scope: "support", entity: "ticket", route: "/support",
  eyebrow: "Ops", title: "Support Wall",
  subtitle: "Every support request raised by the reseller network, as AMS tickets. Tickets are worked in the AMS Manager.",
  icon: Headphones, primaryLabel: "New Ticket",
  creatable: false,
  readOnly: true,
  seed: [],
  columns: [
    {
      key: "subject",
      header: "Subject",
      render: (r) => (
        <a href={`/ams/tickets/${r.id}`} className="font-semibold text-[13px] hover:underline">
          {r.ticket_no ? `${r.ticket_no} · ` : ""}{r.subject}
        </a>
      ),
    },
    { key: "requester", header: "Requester" },
    { key: "reseller", header: "Reseller" },
    { key: "assignee", header: "Assignee" },
    { key: "priority", header: "Priority", render: (r) => <StatusPill value={r.priority} /> },
    { key: "created_at", header: "Opened", render: (r) => String(r.created_at ?? "").slice(0, 10) },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: STATUSES },
    { key: "priority", label: "Priority", options: PRIORITIES },
  ],
  kpis: [
    { label: "Open", icon: Clock, compute: (r) => r.filter((x) => OPEN.has(x.status)).length },
    { label: "Waiting", icon: MessageSquare, compute: (r) => r.filter((x) => WAITING.has(x.status)).length },
    { label: "Resolved", icon: CheckCircle2, compute: (r) => r.filter((x) => x.status === "resolved" || x.status === "closed").length },
    { label: "Critical", icon: XCircle, compute: (r) => r.filter((x) => x.priority === "critical" && OPEN.has(x.status)).length },
  ],
  bulkActions: [],
  rowActions: [],
  formFields: [],
  searchFields: ["subject", "requester", "reseller", "assignee", "ticket_no"],
  primaryField: "subject", subField: "requester",
};
