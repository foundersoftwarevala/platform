import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  BadgePercent,
  BarChart3,
  Bot,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  Landmark,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCcw,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FinanceView } from "@/lib/finance/views";

const COLLAPSE_KEY = "sv:finance-sidebar:collapsed";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return { collapsed, toggleCollapsed };
}

type Item = { id: FinanceView; label: string };
type Group = { id: string; label: string; icon: LucideIcon; items: Item[] };


export const FINANCE_GROUPS: Group[] = [
  {
    id: "overview",
    label: "Finance Overview",
    icon: LayoutDashboard,
    items: [
      { id: "overview_total_balance", label: "Total Balance" },
      { id: "overview_today_inflow", label: "Today's Income" },
      { id: "overview_today_outflow", label: "Today's Expense" },
      { id: "overview_net_profit", label: "Net Profit" },
      { id: "overview_pending", label: "Pending Payments" },
    ],
  },
  {
    id: "wallet",
    label: "Wallet Management",
    icon: Wallet,
    items: [
      { id: "wallet_master", label: "Master Wallet" },
      { id: "wallet_franchise", label: "Franchise Wallets" },
      { id: "wallet_reseller", label: "Reseller Wallets" },
      { id: "wallet_user", label: "User Wallets" },
      { id: "wallet_topup", label: "Wallet Top-up" },
      { id: "wallet_deduction", label: "Wallet Deduction" },
      { id: "wallet_low_balance", label: "Low Balance Alerts" },
    ],
  },
  {
    id: "payments",
    label: "Payment Management",
    icon: CreditCard,
    items: [
      { id: "payment_incoming", label: "Incoming Payments" },
      { id: "payment_outgoing", label: "Outgoing Payments" },
      { id: "payment_failed", label: "Failed Payments" },
      { id: "payment_pending", label: "Pending Payments" },
      { id: "payment_partial", label: "Partial Payments" },
    ],
  },
  {
    id: "gateways",
    label: "Payment Gateways",
    icon: Landmark,
    items: [
      { id: "gateway_upi", label: "UPI" },
      { id: "gateway_bank", label: "Bank Transfer" },
      { id: "gateway_payu", label: "PayU / Razorpay" },
      { id: "gateway_stripe", label: "Stripe" },
      { id: "gateway_paypal", label: "PayPal" },
      { id: "gateway_crypto", label: "Crypto (optional)" },
    ],
  },
  {
    id: "invoices",
    label: "Invoice Management",
    icon: FileText,
    items: [
      { id: "invoice_generate", label: "Generate Invoice" },
      { id: "invoice_auto", label: "Auto Invoice" },
      { id: "invoice_franchise", label: "Franchise Invoice" },
      { id: "invoice_reseller", label: "Reseller Invoice" },
      { id: "invoice_tax", label: "Tax Invoice" },
      { id: "invoice_credit_note", label: "Credit Note" },
      { id: "invoice_debit_note", label: "Debit Note" },
    ],
  },
  {
    id: "plans",
    label: "Subscription & Plans",
    icon: Receipt,
    items: [
      { id: "plan_active", label: "Active Plans" },
      { id: "plan_expired", label: "Expired Plans" },
      { id: "plan_renewal", label: "Renewal Tracking" },
      { id: "plan_upgrade", label: "Upgrade Requests" },
      { id: "plan_downgrade", label: "Downgrade Requests" },
    ],
  },
  {
    id: "commissions",
    label: "Commission Management",
    icon: BadgePercent,
    items: [
      { id: "commission_franchise", label: "Franchise Commission" },
      { id: "commission_reseller", label: "Reseller Commission" },
      { id: "commission_influencer", label: "Influencer Payout" },
      { id: "commission_rules", label: "Commission Rules" },
      { id: "commission_auto_deduct", label: "Auto Deduction" },
    ],
  },
  {
    id: "costs",
    label: "Cost & Expense",
    icon: ArrowDownCircle,
    items: [
      { id: "cost_server", label: "Server Cost" },
      { id: "cost_ai_api", label: "AI / API Cost" },
      { id: "cost_marketing", label: "Marketing Cost" },
      { id: "cost_support", label: "Support Cost" },
      { id: "cost_manual_entry", label: "Manual Expense Entry" },
    ],
  },
  {
    id: "ai_billing",
    label: "AI / API Billing",
    icon: Bot,
    items: [
      { id: "ai_usage_cost", label: "AI Usage Cost" },
      { id: "api_usage_cost", label: "API Usage Cost" },
      { id: "ai_spike_alert", label: "Cost Spike Alerts" },
      { id: "ai_stop_resume", label: "Auto Stop / Resume" },
      { id: "ai_budget_limit", label: "Budget Limits" },
    ],
  },
  {
    id: "refunds",
    label: "Refund & Adjustment",
    icon: RefreshCcw,
    items: [
      { id: "refund_requests", label: "Refund Requests" },
      { id: "refund_approved", label: "Approved Refunds" },
      { id: "refund_rejected", label: "Rejected Refunds" },
      { id: "refund_wallet_adjust", label: "Wallet Adjustment" },
    ],
  },
  {
    id: "tax",
    label: "Compliance & Tax",
    icon: Scale,
    items: [
      { id: "tax_gst_vat", label: "GST / VAT" },
      { id: "tax_tds", label: "TDS" },
      { id: "tax_country_wise", label: "Country-wise Tax" },
      { id: "tax_audit_reports", label: "Audit Reports" },
    ],
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    icon: BarChart3,
    items: [
      { id: "report_daily", label: "Daily Report" },
      { id: "report_monthly", label: "Monthly Report" },
      { id: "report_yearly", label: "Yearly Report" },
      { id: "report_export", label: "Export (PDF / Excel)" },
    ],
  },
  {
    id: "alerts",
    label: "Alerts & Approval",
    icon: AlertTriangle,
    items: [
      { id: "alert_high_amount", label: "High Amount Approval" },
      { id: "alert_manual_override", label: "Manual Override Alert" },
      { id: "alert_risky_transaction", label: "Risky Transaction Alert" },
    ],
  },
  {
    id: "logs",
    label: "Logs & Security",
    icon: ShieldCheck,
    items: [
      { id: "log_transactions", label: "Transaction Logs" },
      { id: "log_activity", label: "Activity Logs" },
      { id: "log_masked_view", label: "Masked Data View" },
      { id: "log_fraud_detection", label: "Fraud Detection" },
    ],
  },
  {
    id: "consoles",
    label: "Finance Consoles",
    icon: Activity,
    items: [
      { id: "revenue", label: "Revenue Dashboard" },
      { id: "payouts", label: "Payout Manager" },
      { id: "wallets", label: "Wallet System" },
      { id: "commissions", label: "Commission Engine" },
      { id: "invoices", label: "Invoice Center" },
      { id: "heatmap", label: "Activity Heatmap" },
      { id: "fraud", label: "Fraud Monitor" },
      { id: "audit", label: "Audit Trail" },
    ],
  },
];

export const VIEW_LABELS: Record<string, { group: string; label: string }> = Object.fromEntries(
  FINANCE_GROUPS.flatMap((g) => g.items.map((i) => [i.id, { group: g.label, label: i.label }])),
);

export function FinanceSidebar({
  activeView,
  onSelect,
  collapsed = false,
  onToggleCollapsed,
  onCloseMobile,
}: {
  activeView: FinanceView;
  onSelect: (view: FinanceView) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onCloseMobile?: () => void;
}) {
  const activeGroup = FINANCE_GROUPS.find((g) => g.items.some((i) => i.id === activeView))?.id;
  const [open, setOpen] = useState<string[]>(activeGroup ? [activeGroup] : ["overview"]);
  const [query, setQuery] = useState("");

  // Keep the group containing the active view expanded, even when the view
  // changes programmatically (e.g. from the header search).
  useEffect(() => {
    if (activeGroup) setOpen((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);

  const toggle = (id: string) =>
    setOpen((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return FINANCE_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const ItemLink = ({ item }: { item: Item }) => {
    const active = activeView === item.id;
    return (
      <button
        type="button"
        title={item.label}
        onClick={() => onSelect(item.id)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors duration-150",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/18 font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" aria-hidden="true" />
        )}
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
            SV
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">Software Vala</span>
          )}
        </div>
        {!collapsed && onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:grid"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapsed && (
        <button
          onClick={onToggleCollapsed}
          className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <div className="focus-glow flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a module…"
              aria-label="Find a finance module"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3" aria-label="Finance modules">
        {(filtered ?? FINANCE_GROUPS).map((group) => {
          const isOpen = filtered ? true : open.includes(group.id);
          const GroupIcon = group.icon;
          const hasActive = group.items.some((i) => i.id === activeView);

          if (collapsed) {
            return (
              <div key={group.id} className="space-y-0.5 border-t border-border/60 pt-2">
                <div
                  title={group.label}
                  className={cn(
                    "grid h-8 place-items-center",
                    hasActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <GroupIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                {group.items.map((item) => (
                  <ItemLink key={item.id} item={item} />
                ))}
              </div>
            );
          }

          return (
            <div key={group.id}>
              <button
                type="button"
                id={`finance-group-${group.id}`}
                onClick={() => toggle(group.id)}
                aria-expanded={isOpen}
                aria-controls={`finance-group-panel-${group.id}`}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                  hasActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{group.label}</span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                />
              </button>
              {isOpen ? (
                <ul
                  id={`finance-group-panel-${group.id}`}
                  aria-labelledby={`finance-group-${group.id}`}
                  className="mt-0.5 space-y-0.5"
                >
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <ItemLink item={item} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border px-3 py-3">
        {collapsed ? (
          <div className="grid place-items-center text-muted-foreground">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Finance Manager · live data</p>
        )}
      </div>
    </div>
  );
}

