import { createFileRoute } from "@tanstack/react-router";
import { TicketPercent, CheckCircle2 } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Code = { id: string; code: string; status: string; uses_count: number; expires_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Code>
      title="Coupons"
      description="Public and private discount coupons with usage limits, stacking rules and expiry."
      crumbLabel="Coupons"
      table="referral_codes"
      searchColumns={["code"]}
      searchPlaceholder="Search coupons…"
      filters={["Status", "Discount", "Product", "Expiry"]}
      tabs={["All", "Active", "Expired"]}
      kpis={[
        { label: "Coupons", icon: <TicketPercent className="size-4" />, tone: "primary" },
        { label: "Active", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "active" }] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "uses", label: "Uses", align: "right" },
        { key: "exp", label: "Expires" },
        { key: "created", label: "Created" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <Row id={c.id}>
          <Cell className="font-mono">{c.code}</Cell>
          <Cell align="right" className="tabular-nums">{c.uses_count.toLocaleString()}</Cell>
          <Cell>{fmtDate(c.expires_at)}</Cell>
          <Cell>{fmtDate(c.created_at)}</Cell>
          <Cell><StatusCell value={c.status} /></Cell>
        </Row>
      )}
      emptyIcon={TicketPercent}
      emptyTitle="No coupons"
      emptyDescription="Public and private coupons appear here with usage, stacking and expiry rules."
      primaryActionLabel="Create Coupon"
    />
  ),
});
