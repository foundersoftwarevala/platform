import { createFileRoute } from "@tanstack/react-router";
import { Receipt, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate } from "@/components/affiliate/EntityWall";

type Sale = { id: string; customer_email: string; amount_cents: number; status: string; created_at: string };

export const Route = createFileRoute("/affiliate-manager/sales")({
  head: () => ({ meta: [{ title: "Sales — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Sale>
      title="Sales"
      description="Every completed sale attributed to an affiliate with revenue and commission."
      crumbLabel="Sales"
      table="orders"
      searchColumns={["customer_email"]}
      searchPlaceholder="Search sales…"
      filters={["Affiliate", "Product", "Country", "Date"]}
      tabs={["Completed", "This Month", "Top Products"]}
      order={{ column: "created_at", ascending: false }}
      kpis={[
        { label: "Completed Sales", icon: <Receipt className="size-4" />, tone: "success", filter: [{ column: "status", value: "completed" }] },
        { label: "Revenue Trend", icon: <TrendingUp className="size-4" />, tone: "primary" },
      ]}
      columns={[
        { key: "cust", label: "Customer" },
        { key: "amount", label: "Revenue", align: "right" },
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
      emptyIcon={Receipt}
      emptyTitle="No sales yet"
      emptyDescription="Completed sales attributed to affiliates appear here with revenue and commission."
    />
  ),
});
