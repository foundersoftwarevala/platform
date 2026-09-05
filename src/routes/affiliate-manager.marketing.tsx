import { createFileRoute } from "@tanstack/react-router";
import { Send, Mail, MessageSquare, Bell } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Broadcast = { id: string; channel: string; subject: string | null; status: string; audience: string; recipients_count: number; scheduled_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/marketing")({
  head: () => ({ meta: [{ title: "Marketing — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Broadcast>
      title="Marketing"
      description="Email, SMS, WhatsApp and Push campaigns with automation and analytics."
      crumbLabel="Marketing"
      table="marketing_broadcasts"
      searchColumns={["subject", "body"]}
      searchPlaceholder="Search broadcasts…"
      filters={["Channel", "Status", "Audience", "Date"]}
      tabs={["All", "Draft", "Scheduled", "Sent", "Failed"]}
      kpis={[
        { label: "Total", icon: <Send className="size-4" />, tone: "primary" },
        { label: "Email", icon: <Mail className="size-4" />, filter: [{ column: "channel", value: "email" }] },
        { label: "WhatsApp", icon: <MessageSquare className="size-4" />, tone: "success", filter: [{ column: "channel", value: "whatsapp" }] },
        { label: "Push", icon: <Bell className="size-4" />, filter: [{ column: "channel", value: "push" }] },
      ]}
      columns={[
        { key: "ch", label: "Channel" },
        { key: "subj", label: "Subject / Body" },
        { key: "aud", label: "Audience" },
        { key: "rcp", label: "Recipients", align: "right" },
        { key: "sch", label: "Scheduled" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(b) => (
        <Row id={b.id}>
          <Cell className="uppercase text-[11px]">{b.channel}</Cell>
          <Cell className="truncate max-w-md">{b.subject ?? "—"}</Cell>
          <Cell>{b.audience}</Cell>
          <Cell align="right" className="tabular-nums">{b.recipients_count.toLocaleString()}</Cell>
          <Cell>{fmtDate(b.scheduled_at)}</Cell>
          <Cell><StatusCell value={b.status} /></Cell>
        </Row>
      )}
      emptyIcon={Send}
      emptyTitle="No broadcasts yet"
      emptyDescription="Compose email/SMS/WhatsApp/push broadcasts for any audience segment."
      primaryActionLabel="New Broadcast"
    />
  ),
});
