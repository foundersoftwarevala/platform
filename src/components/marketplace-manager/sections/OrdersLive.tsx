import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
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

  const { t } = useTranslation();
  const figure = (value: number | undefined) =>
    failed ? "—" : counts === undefined || counts === null ? "…" : String(value ?? 0);

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="Orders & Payments"
        title={t("manager.orders.title")}
        description="Invoices, payments, refunds, returns and status timeline."
      />

      <SubNav items={[...TABS]} active={active} onChange={setActive} />

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t("manager.orders.title")} value={figure(counts?.orders)} />
        <StatCard label={t("manager.orders.paid")} value={figure(counts?.paid)} tone="success" />
        <StatCard label={t("manager.orders.refunded")} value={figure(counts?.refunded)} tone="warning" />
        <StatCard label={t("manager.orders.awaiting")} value={figure(counts?.pending)} tone="default" />
      </div>

      <div className="mt-6">
        {active === "All Orders" && (
          <LiveTable
            resource="orders"
            title={t("manager.orders.title")}
            columns={["order_no", "order_number", "status", "total", "currency", "payment_gateway", "txnid", "created_at"]}
            description="Reading the orders…"
          />
        )}
        {active === "Invoices" && (
          <LiveTable
            resource="invoices"
            title={t("manager.orders.invoices")}
            columns={["invoice_no", "client_name", "total", "status", "issue_date", "auto_generated"]}
            description="Reading the invoices…"
          />
        )}
        {active === "Payments" && (
          <LiveTable
            resource="payments"
            title={t("manager.orders.payment_log")}
            columns={["order_id", "event_type", "provider", "signature_valid", "created_at"]}
            description="Reading the payment log…"
          />
        )}
        {active === "Refunds" && (
          <LiveTable
            resource="refunds"
            title={t("manager.orders.refunds")}
            columns={["order_id", "amount", "currency", "status", "reason", "provider", "created_at"]}
            description="Reading the refunds…"
          />
        )}
        {active === "Returns" && (
          <Card>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ShoppingBag className="h-4 w-4 text-accent" /> {t("manager.orders.returns")}
            </div>
            <EmptyHint text="Software is licensed rather than shipped, so this platform keeps no returns table. A return here is a refund, which the tab beside this one shows." />
          </Card>
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        {t("manager.orders.endpoint_note_before")}{" "}
        {/* The endpoint's path is an address, not prose: it is the same in every language. */}
        <span className="font-mono" translate="no">/api/manager/resource</span>
        {t("manager.orders.endpoint_note_after")}
      </p>
    </div>
  );
}
