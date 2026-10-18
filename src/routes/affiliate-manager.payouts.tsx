import { createFileRoute } from "@tanstack/react-router";
import { Banknote, CheckCircle2, Clock, XCircle } from "lucide-react";
import { EntityWall, Row, Cell, StatusCell, fmtMoney, fmtDate, type EntitySource } from "@/components/affiliate/EntityWall";

type Payout = { id: string; affiliate_id: string; amount_cents: number; currency: string; status: string; method: string; requested_at: string };

// Payouts are the affiliate rows of partner_payouts. Its statuses are
// requested / processing / completed / failed, so "pending" is "requested" and
// "paid" is "completed". Amounts are stored in major units.
const STATUS: Record<string, string> = { pending: "requested", processing: "processing", paid: "completed", failed: "failed" };
const source: EntitySource<Payout> = {
  table: "partner_payouts",
  select: "id, partner_id, amount, currency, status, payment_method, requested_at",
  fixed: [{ column: "partner_kind", value: "affiliate" }],
  filter: (f) =>
    f.column === "status" && STATUS[String(f.value)] ? [{ ...f, value: STATUS[String(f.value)] }] : null,
  sortColumn: (field) => (field === "requested_at" ? field : null),
  order: { column: "requested_at", ascending: false },
  toRows: (rows) =>
    rows.map((r) => ({
      id: String(r.id),
      affiliate_id: String(r.partner_id ?? ""),
      amount_cents: Math.round(Number(r.amount ?? 0) * 100),
      currency: String(r.currency ?? ""),
      status: String(r.status ?? ""),
      method: String(r.payment_method ?? ""),
      requested_at: String(r.requested_at ?? ""),
    })),
};

export const Route = createFileRoute("/affiliate-manager/payouts")({
  head: () => ({ meta: [{ title: "Payouts — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Payout>
      title="Payouts"
      description="Withdraw requests, settlements and bank/UPI/PayPal/Wise transfers with audit."
      crumbLabel="Payouts"
      table="partner_payouts"
      source={source}
      searchColumns={[]}
      searchPlaceholder="Search payouts…"
      filters={["Status", "Method", "Currency", "Date"]}
      tabs={["All", "Pending", "Processing", "Paid", "Failed"]}
      order={{ column: "requested_at", ascending: false }}
      kpis={[
        { label: "Total", icon: <Banknote className="size-4" />, tone: "primary" },
        { label: "Pending", icon: <Clock className="size-4" />, tone: "warning", filter: [{ column: "status", value: "pending" }] },
        { label: "Paid", icon: <CheckCircle2 className="size-4" />, tone: "success", filter: [{ column: "status", value: "paid" }] },
        { label: "Failed", icon: <XCircle className="size-4" />, tone: "destructive", filter: [{ column: "status", value: "failed" }] },
      ]}
      columns={[
        { key: "aff", label: "Affiliate" },
        { key: "amt", label: "Amount", align: "right" },
        { key: "method", label: "Method" },
        { key: "req", label: "Requested" },
        { key: "status", label: "Status" },
      ]}
      renderRow={(p) => (
        <Row id={p.id}>
          <Cell className="font-mono text-[11px] text-muted-foreground">{p.affiliate_id.slice(0, 8)}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(p.amount_cents)} {p.currency}</Cell>
          <Cell>{p.method}</Cell>
          <Cell>{fmtDate(p.requested_at)}</Cell>
          <Cell><StatusCell value={p.status} /></Cell>
        </Row>
      )}
      emptyIcon={Banknote}
      emptyTitle="No payouts yet"
      emptyDescription="Approved payout requests will appear here with status, method and audit trail."
      primaryActionLabel="Issue Payout"
    />
  ),
});
