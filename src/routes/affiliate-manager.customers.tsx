import { createFileRoute } from "@tanstack/react-router";
import { UsersRound, ShoppingCart } from "lucide-react";
import { EntityWall, Row, Cell, fmtDate } from "@/components/affiliate/EntityWall";

type Customer = { id: string; email: string; affiliate_id: string | null; first_order_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/customers")({
  head: () => ({ meta: [{ title: "Customers — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Customer>
      title="Customer Directory"
      description="Every customer acquired by every affiliate with purchase history and licenses."
      crumbLabel="Customers"
      table="customers"
      searchColumns={["email"]}
      searchPlaceholder="Search customers by email…"
      filters={["Affiliate", "Product", "Date"]}
      tabs={["All", "New", "Repeat", "Subscribers", "Churned"]}
      kpis={[
        { label: "Total", icon: <UsersRound className="size-4" />, tone: "primary" },
        { label: "With Orders", icon: <ShoppingCart className="size-4" />, tone: "success" },
      ]}
      columns={[
        { key: "email", label: "Customer" },
        { key: "aff", label: "Affiliate" },
        { key: "first", label: "First Order" },
        { key: "created", label: "Created" },
      ]}
      renderRow={(c) => (
        <Row id={c.id}>
          <Cell>{c.email}</Cell>
          <Cell className="font-mono text-[11px] text-muted-foreground">{c.affiliate_id?.slice(0, 8) ?? "—"}</Cell>
          <Cell>{fmtDate(c.first_order_at)}</Cell>
          <Cell>{fmtDate(c.created_at)}</Cell>
        </Row>
      )}
      emptyIcon={UsersRound}
      emptyTitle="No customers yet"
      emptyDescription="Customers acquired via affiliate links, codes and campaigns appear here."
      primaryActionLabel="Add Customer"
    />
  ),
});
