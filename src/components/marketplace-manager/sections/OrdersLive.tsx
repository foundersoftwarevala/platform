import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, EmptyHint, PageHeader, StatCard, SubNav } from "../ui";
import { LiveTable } from "../LiveTable";

/**
 * Orders, over the orders that exist.
 *
 * The designed screen - kept and still exported as S.OrdersSection - carried
 * five tabs, four counters and a feature matrix under the words "Awaiting live
 * data". Twenty-one orders, a hundred and thirty-one invoices, ten payments
 * taken and one refund were sitting in the database while it said so.
 *
 * This keeps the screen: the same title, the same five tabs in the same order,
 * the same four counters. Each tab is now the real table, read and written
 * through the endpoint every other connected section uses. Returns is the one
 * tab with nothing behind it - this platform has no returns table - and it
 * says that rather than showing an empty grid as though it were a count of
 * zero.
 */

type Counts = { orders: number; paid: number; refunded: number; pending: number };

const TABS = ["All Orders", "Invoices", "Payments", "Refunds", "Returns"] as const;

export function OrdersSection() {
  const [active, setActive] = useState<string>(TABS[0]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        const read = async (resource: string) => {
          const res = await fetch(`/api/manager/resource?resource=${resource}&limit=500`, { headers });
          if (!res.ok) throw new Error(String(res.status));
          const payload = (await res.json()) as { rows?: Record<string, unknown>[]; total?: number };
          return payload;
        };
        const [orders, refunds] = await Promise.all([read("orders"), read("refunds")]);
        if (!alive) return;
        const rows = orders.rows ?? [];
        setCounts({
          orders: orders.total ?? rows.length,
          paid: rows.filter((r) => r.status === "paid").length,
          refunded: refunds.total ?? (refunds.rows ?? []).length,
          pending: rows.filter((r) => r.status === "pending" || r.status === "pending_payment").length,
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const figure = (value: number | undefined) =>
    failed ? "—" : counts === undefined || counts === null ? "…" : String(value ?? 0);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Orders & Payments"
        title="Orders"
        description="Invoices, payments, refunds, returns and status timeline."
      />

      <SubNav items={[...TABS]} active={active} onChange={setActive} />

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Orders" value={figure(counts?.orders)} />
        <StatCard label="Paid" value={figure(counts?.paid)} tone="success" />
        <StatCard label="Refunded" value={figure(counts?.refunded)} tone="warning" />
        <StatCard label="Awaiting payment" value={figure(counts?.pending)} tone="default" />
      </div>

      <div className="mt-6">
        {active === "All Orders" && (
          <LiveTable
            resource="orders"
            title="Orders"
            columns={["order_no", "order_number", "status", "total", "currency", "payment_gateway", "txnid", "created_at"]}
            description="Reading the orders…"
          />
        )}
        {active === "Invoices" && (
          <LiveTable
            resource="invoices"
            title="Invoices"
            columns={["invoice_no", "client_name", "total", "status", "issue_date", "auto_generated"]}
            description="Reading the invoices…"
          />
        )}
        {active === "Payments" && (
          <LiveTable
            resource="payments"
            title="Payment log"
            columns={["order_id", "event_type", "provider", "signature_valid", "created_at"]}
            description="Reading the payment log…"
          />
        )}
        {active === "Refunds" && (
          <LiveTable
            resource="refunds"
            title="Refunds"
            columns={["order_id", "amount", "currency", "status", "reason", "provider", "created_at"]}
            description="Reading the refunds…"
          />
        )}
        {active === "Returns" && (
          <Card>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-accent" /> Returns
            </div>
            <EmptyHint text="Software is licensed rather than shipped, so this platform keeps no returns table. A return here is a refund, which the tab beside this one shows." />
          </Card>
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Every tab above reads the real table through{" "}
        <span className="font-mono">/api/manager/resource</span>. An order&apos;s money is never
        editable from a screen; what an operator may change is its status.
      </p>
    </div>
  );
}
