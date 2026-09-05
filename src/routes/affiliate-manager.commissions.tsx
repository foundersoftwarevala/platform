import { createFileRoute } from "@tanstack/react-router";
import { Percent, CheckCircle2, Clock, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate } from "@/components/affiliate/EntityWall";

type Commission = { id: string; affiliate_id: string; amount_cents: number; currency: string; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/commissions")({
  head: () => ({ meta: [{ title: "Commissions — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Commission>
      title="Commissions"
      description="Pending, approved and paid commissions across every plan and rule."
      crumbLabel="Commissions"
      table="commissions"
      searchColumns={[]}
      searchPlaceholder="Search commissions…"
      filters={["Status", "Affiliate", "Campaign", "Date"]}
      tabs={["All", "Pending", "Approved", "Paid", "Rejected"]}
      kpis={[
        { label: "Total", icon: <Percent className="size-4" />, tone: "primary" },
        { label: "Pending", icon: <Clock className="size-4" />, tone: "warning", filter: [{ column: "status", value: "pending" }] },
        { label: "Approved", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "approved" }] },
        { label: "Paid", tone: "success", filter: [{ column: "status", value: "paid" }] },
        { label: "Rejected", icon: <XCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "rejected" }] },
      ]}
      columns={[
        { key: "aff", label: "Affiliate" },
        { key: "amt", label: "Amount", align: "right" },
        { key: "cur", label: "Currency" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <Row id={c.id}>
          <Cell className="font-mono text-[11px] text-muted-foreground">{c.affiliate_id.slice(0, 8)}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(c.amount_cents)}</Cell>
          <Cell>{c.currency}</Cell>
          <Cell>{fmtDate(c.created_at)}</Cell>
          <Cell><StatusCell value={c.status} /></Cell>
        </Row>
      )}
      emptyIcon={Percent}
      emptyTitle="No commissions yet"
      emptyDescription="Approved and paid commissions appear here across every plan and rule."
    />
  ),
});
