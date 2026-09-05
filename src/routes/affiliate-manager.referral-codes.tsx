import { createFileRoute } from "@tanstack/react-router";
import { Ticket, CheckCircle2, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtDate } from "@/components/affiliate/EntityWall";

type Code = { id: string; code: string; status: string; uses_count: number; expires_at: string | null; created_at: string };

export const Route = createFileRoute("/affiliate-manager/referral-codes")({
  head: () => ({ meta: [{ title: "Referral Codes — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Code>
      title="Referral Codes"
      description="Coupon, referral and campaign codes with usage and expiry."
      crumbLabel="Referral Codes"
      table="referral_codes"
      searchColumns={["code"]}
      searchPlaceholder="Search codes…"
      filters={["Status", "Campaign", "Affiliate", "Expiry"]}
      tabs={["All", "Active", "Expired", "Disabled"]}
      kpis={[
        { label: "Total Codes", icon: <Ticket className="size-4" />, tone: "primary" },
        { label: "Active", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "active" }] },
        { label: "Expired", icon: <XCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "expired" }] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "uses", label: "Uses", align: "right" },
        { key: "expires", label: "Expires" },
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
      emptyIcon={Ticket}
      emptyTitle="No codes generated"
      emptyDescription="Generate codes in bulk from campaigns or issue custom codes per affiliate."
      primaryActionLabel="Generate Codes"
    />
  ),
});
