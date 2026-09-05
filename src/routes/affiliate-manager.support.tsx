import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Ticket = { id: string; ticket_no: string; subject: string; priority: string; status: string; channel: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/support")({
  head: () => ({ meta: [{ title: "Support — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Ticket>
      title="Support"
      description="Tickets, live chat, WhatsApp, email and calls with SLA and escalation."
      crumbLabel="Support"
      table="support_tickets"
      searchColumns={["subject", "ticket_no"]}
      searchPlaceholder="Search tickets by number or subject…"
      filters={["Status", "Priority", "Channel", "Assignee"]}
      tabs={["All", "Open", "Pending", "Resolved", "Urgent"]}
      kpis={[
        { label: "Total", icon: <LifeBuoy className="size-4" />, tone: "primary" },
        { label: "Open", icon: <Clock className="size-4" />, tone: "warning", filter: [{ column: "status", value: "open" }] },
        { label: "Urgent", icon: <AlertTriangle className="size-4" />, tone: "destructive", filter: [{ column: "priority", value: "urgent" }] },
        { label: "Resolved", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "resolved" }] },
      ]}
      columns={[
        { key: "no", label: "Ticket" },
        { key: "subj", label: "Subject" },
        { key: "pri", label: "Priority" },
        { key: "ch", label: "Channel" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(t) => (
        <Row id={t.id}>
          <Cell className="font-mono text-[12px]">{t.ticket_no}</Cell>
          <Cell className="font-medium truncate max-w-md">{t.subject}</Cell>
          <Cell><StatusCell value={t.priority} /></Cell>
          <Cell className="uppercase text-[11px]">{t.channel}</Cell>
          <Cell>{fmtDate(t.created_at)}</Cell>
          <Cell><StatusCell value={t.status} /></Cell>
        </Row>
      )}
      emptyIcon={LifeBuoy}
      emptyTitle="No tickets"
      emptyDescription="Support tickets from every channel appear here with SLA and escalation."
      primaryActionLabel="New Ticket"
    />
  ),
});
