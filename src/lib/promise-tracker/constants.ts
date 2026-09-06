import type { Tables } from "@/integrations/supabase/types";

export type PromiseRow = Tables<"promises">;
export type PromiseCategoryRow = Tables<"promise_categories">;
export type PromiseSubcategoryRow = Tables<"promise_subcategories">;
export type PromiseRuleRow = Tables<"promise_rules">;
export type PromiseInsightRow = Tables<"promise_ai_insights">;
export type PromiseAuditLogRow = Tables<"promise_audit_logs">;
export type PromiseSettingsRow = Tables<"promise_settings">;

export type PromiseWithCategory = PromiseRow & {
  promise_categories: Pick<PromiseCategoryRow, "id" | "slug" | "label" | "accent"> | null;
};

export type PromiseStatus = "active" | "pending" | "delayed" | "fulfilled" | "broken";
export type PromisePriority = "critical" | "high" | "medium" | "low";

export const PROMISE_STATUSES: PromiseStatus[] = [
  "active",
  "pending",
  "delayed",
  "fulfilled",
  "broken",
];

export const PROMISE_PRIORITIES: PromisePriority[] = ["critical", "high", "medium", "low"];

export const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-info/15 text-info border-info/30" },
  pending: { label: "Pending", className: "bg-warning/15 text-warning border-warning/30" },
  delayed: { label: "Delayed", className: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
  fulfilled: { label: "Fulfilled", className: "bg-success/15 text-success border-success/30" },
  broken: {
    label: "Broken",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export const PRIORITY_META: Record<string, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  high: { label: "High", className: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
  medium: { label: "Medium", className: "bg-warning/15 text-warning border-warning/30" },
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
};

export const ESCALATION_LEVELS = [
  { level: 1, label: "Reminder", className: "bg-info/15 text-info border-info/30" },
  { level: 2, label: "Manager Alert", className: "bg-warning/15 text-warning border-warning/30" },
  { level: 3, label: "Admin Alert", className: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
  {
    level: 4,
    label: "Legal / Penalty",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
] as const;

export const NANO_CATEGORIES = [
  "Exact Date",
  "Exact Time",
  "Conditional Trigger",
  "Dependency Linked",
  "Auto Reminder",
];

export const LINKED_MODULES = [
  "CRM",
  "Sales",
  "Support",
  "Billing",
  "Finance",
  "Legal",
  "Compliance",
  "Delivery",
  "Release",
  "Engineering",
  "Infrastructure",
  "Integrations",
  "Partnerships",
  "Reporting",
  "Incidents",
];

export const PROMISE_EXPORT_COLUMNS = [
  "code",
  "title",
  "category",
  "sub_category",
  "owner",
  "receiver",
  "status",
  "priority",
  "deadline",
  "escalation_level",
  "fine_amount",
  "tip_amount",
];

export const AUDIT_LOG_EXPORT_COLUMNS = [
  "timestamp",
  "action",
  "promise_code",
  "actor",
  "actor_role",
  "details",
];

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRuleAmount(rule: Pick<PromiseRuleRow, "rule_type" | "amount">) {
  return rule.rule_type === "percentage"
    ? `${Number(rule.amount)}%`
    : formatCurrency(Number(rule.amount));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function remainingTime(deadline: string, now: Date) {
  const diffMs = new Date(deadline).getTime() - now.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const abs = Math.abs(minutes);
  const parts =
    abs >= 1440
      ? `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h`
      : abs >= 60
        ? `${Math.floor(abs / 60)}h ${abs % 60}m`
        : `${abs}m`;
  return {
    minutes,
    isOverdue: minutes < 0,
    text: minutes < 0 ? `${parts} overdue` : `${parts} left`,
  };
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  // Deterministic header set: explicit columns, else the union of all row keys.
  const headers = columns ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (headers.length === 0) return "";
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
