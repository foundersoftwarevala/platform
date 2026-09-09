import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Wallet = T["finance_wallets"]["Row"];
export type WalletTransaction = T["finance_wallet_transactions"]["Row"];
export type FinanceTransaction = T["finance_transactions"]["Row"];
export type Gateway = T["finance_gateways"]["Row"];
export type Invoice = T["finance_invoices"]["Row"];
export type Plan = T["finance_plans"]["Row"];
export type Subscription = T["finance_subscriptions"]["Row"] & { finance_plans?: Plan | null };
export type Commission = T["finance_commissions"]["Row"];
export type Payout = T["finance_payouts"]["Row"];
export type Expense = T["finance_expenses"]["Row"];
export type AiApiUsage = T["finance_ai_api_usage"]["Row"];
export type AiControl = T["finance_ai_controls"]["Row"];
export type Refund = T["finance_refunds"]["Row"];
export type TaxRecord = T["finance_tax_records"]["Row"];
export type FinanceAlert = T["finance_alerts"]["Row"];
export type Approval = T["finance_approvals"]["Row"];
export type AuditLog = T["finance_audit_logs"]["Row"];
export type FraudAlert = T["finance_fraud_alerts"]["Row"];
export type DailyMetric = T["finance_daily_metrics"]["Row"];
export type ActivityHeat = T["finance_activity_heat"]["Row"];

export type InvoiceLineItem = {
  description: string;
  qty: number;
  rate: number;
};
