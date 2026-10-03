import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, CheckCircle2, Clock, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate, type EntitySource } from "@/components/affiliate/EntityWall";

type Order = { id: string; customer_email: string; amount_cents: number; currency: string; status: string; created_at: string };

// Affiliate orders are the marketplace orders attributed to an affiliate
// (marketplace_order_attributions → marketplace_orders). Orders store no
// customer email, so that column and its search stay empty. Amounts are
// stored in major units; "pending" is the stored "pending_payment".
const STATUS: Record<string, string> = { pending: "pending_payment", completed: "completed", refunded: "refunded", cancelled: "cancelled" };
const source: EntitySource<Order> = {
  table: "marketplace_order_attributions",
  select: "id, attributed_at, marketplace_orders!inner(id, total, currency, status, created_at)",
  fixed: [{ column: "affiliate_partner_id", op: "not_null", value: null }],
  filter: (f) =>
    f.column === "status" && STATUS[String(f.value)]
      ? [{ column: "marketplace_orders.status", value: STATUS[String(f.value)] }]
      : null,
  sortColumn: () => null,
  order: { column: "attributed_at", ascending: false },
  toRows: (rows) =>
    rows.map((r) => {
      const o = (r.marketplace_orders ?? {}) as Record<string, unknown>;
      return {
        id: String(o.id ?? r.id),
        customer_email: "",
        amount_cents: Math.round(Number(o.total ?? 0) * 100),
        currency: String(o.currency ?? ""),
        status: String(o.status ?? ""),
        created_at: String(o.created_at ?? r.attributed_at ?? ""),
      };
    }),
};

export const Route = createFileRoute("/affiliate-manager/orders")({
  head: () => ({ meta: [{ title: "Orders — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Order>
      title="Orders"
      description="Every affiliate-attributed order with invoice, payment and refund lifecycle."
      crumbLabel="Orders"
      table="marketplace_order_attributions"
      source={source}
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
