import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, CheckCircle2, Clock, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate } from "@/components/affiliate/EntityWall";

type Order = { id: string; customer_email: string; amount_cents: number; currency: string; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/orders")({
  head: () => ({ meta: [{ title: "Orders — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Order>
      title="Orders"
      description="Every affiliate-attributed order with invoice, payment and refund lifecycle."
      crumbLabel="Orders"
      table="orders"
      searchColumns={["customer_email"]}
      searchPlaceholder="Search orders by customer email…"
      filters={["Status", "Affiliate", "Product", "Date"]}
      tabs={["All", "Pending", "Completed", "Refunded", "Cancelled"]}
      kpis={[
        { label: "Total", icon: <ShoppingCart className="size-4" />, tone: "primary" },
        { label: "Completed", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "completed" }] },
        { label: "Pending", icon: <Clock className="size-4" />, tone: "warning", filter: [{ column: "status", value: "pending" }] },
        { label: "Refunded", icon: <XCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "refunded" }] },
      ]}
      columns={[
        { key: "cust", label: "Customer" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(o) => (
        <Row id={o.id}>
          <Cell>{o.customer_email}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(o.amount_cents)}</Cell>
          <Cell>{fmtDate(o.created_at)}</Cell>
          <Cell><StatusCell value={o.status} /></Cell>
        </Row>
      )}
      emptyIcon={ShoppingCart}
      emptyTitle="No orders yet"
      emptyDescription="Orders attributed to affiliates appear here with invoice, payment and refund status."
    />
  ),
});
