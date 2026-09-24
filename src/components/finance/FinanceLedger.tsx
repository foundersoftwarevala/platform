import { useEffect, useState } from "react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { LiveTable } from "@/components/marketplace-manager/LiveTable";

/**
 * The money the platform has actually moved.
 *
 * Twenty-three finance tables held two thousand rows between them and not one
 * screen read any of them. The Finance Manager's three built screens ask
 * billing_plans, invoices, wallets and usage_daily - the API-billing tables,
 * which are empty - so the console showed zero over a ledger that was full.
 *
 * Those three screens are untouched and still the first tabs of this module.
 * This is a fourth view over the tables with the money in them: transactions,
 * wallets and their movements, payouts, commissions, refunds, subscriptions,
 * expenses, tax, approvals, fraud alerts, gateways, plans and the daily
 * figures.
 *
 * Nothing here can rewrite an amount. What an operator changes is a decision -
 * approve, reject, mark settled - which is what the endpoint allows and all it
 * allows.
 */

const VIEWS = [
  { key: "finance_daily_metrics", label: "Daily figures" },
  { key: "finance_transactions", label: "Transactions" },
  { key: "finance_wallets", label: "Wallets" },
  { key: "finance_wallet_transactions", label: "Wallet movements" },
  { key: "finance_payouts", label: "Payouts" },
  { key: "finance_commissions", label: "Commissions" },
  { key: "finance_refunds", label: "Refunds" },
  { key: "finance_subscriptions", label: "Subscriptions" },
  { key: "finance_expenses", label: "Expenses" },
  { key: "finance_tax_records", label: "Tax" },
  { key: "finance_approvals", label: "Approvals" },
  { key: "finance_fraud_alerts", label: "Fraud" },
  { key: "finance_gateways", label: "Gateways" },
  { key: "finance_plans", label: "Plans" },
  { key: "invoices", label: "Invoices" },
  // The three tables the survey found last: six hundred and seventy-two hours
  // of transaction activity, two hundred and twenty-five days of AI spend and
  // the controls set against it.
  { key: "finance_activity_heat", label: "Activity by hour" },
  { key: "finance_ai_api_usage", label: "AI and API spend" },
  { key: "finance_ai_controls", label: "AI spend controls" },
  { key: "payment_audit_logs", label: "Payment audit" },
] as const;

type Totals = { revenue: number; expenses: number; profit: number; days: number } | null;

export function FinanceLedger() {
  const [active, setActive] = useState<string>(VIEWS[0].key);
  const [totals, setTotals] = useState<Totals>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/manager/resource?resource=finance_daily_metrics&limit=500", { headers });
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as { rows?: Record<string, unknown>[] };
        const rows = payload.rows ?? [];
        if (!alive) return;
        const sum = (key: string) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
        setTotals({
          revenue: sum("revenue"),
          expenses: sum("expenses"),
          profit: sum("profit"),
          days: rows.length,
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const money = (value: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ledger
        </div>
        <h2 className="text-lg font-bold text-foreground">The money that has moved</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Read from the finance tables themselves. An amount is what happened and cannot be edited
          here; what an operator decides is whether it is approved, rejected or settled.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Revenue", value: totals?.revenue },
          { label: "Expenses", value: totals?.expenses },
          { label: "Profit", value: totals?.profit },
          { label: "Days recorded", value: totals?.days, plain: true },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {failed ? "—" : totals === null ? "…" : card.plain ? String(card.value) : `₹${money(card.value ?? 0)}`}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => setActive(view.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active === view.key
                ? "bg-foreground text-background"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <LiveTable
        key={active}
        resource={active}
        title={VIEWS.find((v) => v.key === active)?.label ?? "Ledger"}
        description="Reading the ledger…"
      />
    </div>
  );
}
