import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  PauseCircle,
  MessageSquare,
  Megaphone,
  Wallet,
  Ban,
  Tags,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Mail,
} from "lucide-react";

export type BulkScope =
  | "affiliates"
  | "applications"
  | "links"
  | "codes"
  | "campaigns"
  | "commissions"
  | "payouts"
  | "orders"
  | "customers";

export type BulkAction = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  scope: BulkScope[];
  tone: "primary" | "success" | "warning" | "destructive" | "neutral";
  requiresConfirm: boolean;
  destructive?: boolean;
  estimatedRate: number; // simulated items/sec for progress copy
};

export const BULK_ACTIONS: BulkAction[] = [
  {
    id: "approve",
    label: "Mass Approve",
    description: "Approve selected affiliates or applications and unlock their dashboards.",
    icon: BadgeCheck,
    scope: ["affiliates", "applications"],
    tone: "success",
    requiresConfirm: true,
    estimatedRate: 240,
  },
  {
    id: "suspend",
    label: "Mass Suspend",
    description: "Temporarily disable selected affiliates. Links continue tracking but commissions pause.",
    icon: PauseCircle,
    scope: ["affiliates"],
    tone: "warning",
    requiresConfirm: true,
    destructive: true,
    estimatedRate: 180,
  },
  {
    id: "terminate",
    label: "Mass Terminate",
    description: "Permanently terminate affiliate accounts. Irreversible.",
    icon: Ban,
    scope: ["affiliates"],
    tone: "destructive",
    requiresConfirm: true,
    destructive: true,
    estimatedRate: 120,
  },
  {
    id: "message",
    label: "Send Mass Message",
    description: "Compose a broadcast email, in-app or SMS to the selected recipients.",
    icon: MessageSquare,
    scope: ["affiliates", "applications", "customers"],
    tone: "primary",
    requiresConfirm: true,
    estimatedRate: 320,
  },
  {
    id: "assign-campaign",
    label: "Assign to Campaign",
    description: "Add selected affiliates to one or more campaigns with custom terms.",
    icon: Megaphone,
    scope: ["affiliates"],
    tone: "primary",
    requiresConfirm: true,
    estimatedRate: 400,
  },
  {
    id: "generate-payouts",
    label: "Generate Payouts",
    description: "Create payout batches from approved commissions for the selected affiliates.",
    icon: Wallet,
    scope: ["affiliates", "commissions"],
    tone: "success",
    requiresConfirm: true,
    estimatedRate: 90,
  },
  {
    id: "approve-commissions",
    label: "Approve Commissions",
    description: "Move pending commissions to approved status, ready for payout.",
    icon: ShieldCheck,
    scope: ["commissions"],
    tone: "success",
    requiresConfirm: true,
    estimatedRate: 500,
  },
  {
    id: "reject-commissions",
    label: "Reject Commissions",
    description: "Reject and reverse pending commissions with audit trail.",
    icon: RotateCcw,
    scope: ["commissions"],
    tone: "destructive",
    requiresConfirm: true,
    destructive: true,
    estimatedRate: 480,
  },
  {
    id: "retry-payouts",
    label: "Retry Failed Payouts",
    description: "Re-attempt failed payout batches through the configured provider.",
    icon: RotateCcw,
    scope: ["payouts"],
    tone: "warning",
    requiresConfirm: true,
    estimatedRate: 60,
  },
  {
    id: "tag",
    label: "Apply Tags",
    description: "Add tags or segments to selected records for filtering and automations.",
    icon: Tags,
    scope: ["affiliates", "customers", "campaigns", "links", "codes"],
    tone: "neutral",
    requiresConfirm: false,
    estimatedRate: 800,
  },
  {
    id: "invite",
    label: "Invite Applicants",
    description: "Send onboarding invites to selected emails with a tokenized signup link.",
    icon: Mail,
    scope: ["applications"],
    tone: "primary",
    requiresConfirm: true,
    estimatedRate: 600,
  },
  {
    id: "delete",
    label: "Delete",
    description: "Permanently delete selected drafts or inactive records. Irreversible.",
    icon: Trash2,
    scope: ["links", "codes", "campaigns"],
    tone: "destructive",
    requiresConfirm: true,
    destructive: true,
    estimatedRate: 700,
  },
];

export const BULK_SCOPES: { id: BulkScope; label: string; route: string }[] = [
  { id: "affiliates", label: "Affiliates", route: "/affiliate-manager/affiliates" },
  { id: "applications", label: "Applications", route: "/affiliate-manager/applications" },
  { id: "links", label: "Affiliate Links", route: "/affiliate-manager/affiliate-links" },
  { id: "codes", label: "Referral Codes", route: "/affiliate-manager/referral-codes" },
  { id: "campaigns", label: "Campaigns", route: "/affiliate-manager/campaigns" },
  { id: "commissions", label: "Commissions", route: "/affiliate-manager/commissions" },
  { id: "payouts", label: "Payouts", route: "/affiliate-manager/payouts" },
  { id: "orders", label: "Orders", route: "/affiliate-manager/orders" },
  { id: "customers", label: "Customers", route: "/affiliate-manager/customers" },
];

// ---------------- Import / Export schemas ----------------

export type FieldSpec = {
  name: string;
  type: "string" | "email" | "url" | "number" | "currency" | "date" | "enum" | "boolean" | "code";
  required: boolean;
  example: string;
  notes?: string;
  enumValues?: string[];
};

export type DatasetSpec = {
  id:
    | "affiliates"
    | "links"
    | "codes"
    | "campaigns"
    | "commissions"
    | "payouts";
  label: string;
  description: string;
  scope: BulkScope;
  fields: FieldSpec[];
  exportColumns: string[];
};

export const DATASETS: DatasetSpec[] = [
  {
    id: "affiliates",
    label: "Affiliates",
    description: "Master record per affiliate with contact, payout and tier details.",
    scope: "affiliates",
    fields: [
      { name: "external_id", type: "string", required: false, example: "AFF-1042", notes: "Your existing ID for upserts." },
      { name: "first_name", type: "string", required: true, example: "Ananya" },
      { name: "last_name", type: "string", required: true, example: "Mehta" },
      { name: "email", type: "email", required: true, example: "ananya@partner.io" },
      { name: "country", type: "string", required: true, example: "IN", notes: "ISO 3166-1 alpha-2." },
      { name: "tier", type: "enum", required: false, example: "gold", enumValues: ["bronze", "silver", "gold", "platinum"] },
      { name: "status", type: "enum", required: false, example: "active", enumValues: ["pending", "active", "suspended", "terminated"] },
      { name: "payout_method", type: "enum", required: false, example: "bank", enumValues: ["bank", "paypal", "wise", "stripe", "crypto"] },
      { name: "payout_currency", type: "string", required: false, example: "USD" },
      { name: "tags", type: "string", required: false, example: "saas;india;top-10", notes: "Semicolon separated." },
    ],
    exportColumns: ["id", "external_id", "first_name", "last_name", "email", "country", "tier", "status", "joined_at", "sales_30d", "revenue_30d", "commission_pending", "commission_paid_ytd"],
  },
  {
    id: "links",
    label: "Affiliate Links",
    description: "Tracking links with destination URL, UTM, and ownership.",
    scope: "links",
    fields: [
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      { name: "slug", type: "code", required: true, example: "ananya-q3", notes: "URL-safe, unique." },
      { name: "destination_url", type: "url", required: true, example: "https://softwarevala.com/pricing" },
      { name: "campaign", type: "string", required: false, example: "q3-launch" },
      { name: "utm_source", type: "string", required: false, example: "newsletter" },
      { name: "utm_medium", type: "string", required: false, example: "email" },
      { name: "utm_campaign", type: "string", required: false, example: "q3-launch" },
      { name: "expires_at", type: "date", required: false, example: "2026-12-31" },
    ],
    exportColumns: ["id", "slug", "affiliate", "destination_url", "campaign", "clicks", "uniques", "conversions", "revenue", "created_at"],
  },
  {
    id: "codes",
    label: "Referral Codes",
    description: "Discount and tracking codes assigned to affiliates.",
    scope: "codes",
    fields: [
      { name: "code", type: "code", required: true, example: "ANANYA20", notes: "Unique, A-Z 0-9 -." },
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      { name: "discount_type", type: "enum", required: true, example: "percent", enumValues: ["percent", "fixed", "trial"] },
      { name: "discount_value", type: "number", required: true, example: "20" },
      { name: "max_redemptions", type: "number", required: false, example: "500" },
      { name: "starts_at", type: "date", required: false, example: "2026-07-01" },
      { name: "expires_at", type: "date", required: false, example: "2026-12-31" },
    ],
    exportColumns: ["code", "affiliate", "discount_type", "discount_value", "redemptions", "revenue", "status", "expires_at"],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Marketing programs with budget, products, schedule and approval.",
    scope: "campaigns",
    fields: [
      { name: "name", type: "string", required: true, example: "Q3 Launch" },
      { name: "owner_email", type: "email", required: true, example: "ops@softwarevala.com" },
      { name: "products", type: "string", required: false, example: "SKU-001;SKU-014", notes: "Semicolon separated SKUs." },
      { name: "budget", type: "currency", required: false, example: "50000.00" },
      { name: "currency", type: "string", required: false, example: "USD" },
      { name: "starts_at", type: "date", required: true, example: "2026-07-01" },
      { name: "ends_at", type: "date", required: true, example: "2026-09-30" },
      { name: "status", type: "enum", required: false, example: "draft", enumValues: ["draft", "scheduled", "live", "paused", "ended"] },
    ],
    exportColumns: ["id", "name", "owner", "budget", "spent", "affiliates", "revenue", "status", "starts_at", "ends_at"],
  },
  {
    id: "commissions",
    label: "Commissions",
    description: "Manual commission adjustments and one-off accruals.",
    scope: "commissions",
    fields: [
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      { name: "order_id", type: "string", required: false, example: "ORD-559813" },
      { name: "plan", type: "string", required: false, example: "default-revshare" },
      { name: "amount", type: "currency", required: true, example: "120.50" },
      { name: "currency", type: "string", required: true, example: "USD" },
      { name: "type", type: "enum", required: true, example: "accrual", enumValues: ["accrual", "adjustment", "reversal", "bonus"] },
      { name: "period", type: "string", required: false, example: "2026-06", notes: "YYYY-MM." },
      { name: "note", type: "string", required: false, example: "Manual adjustment for chargeback." },
    ],
    exportColumns: ["id", "affiliate", "order", "plan", "amount", "currency", "type", "status", "period", "created_at"],
  },
  {
    id: "payouts",
    label: "Payouts",
    description: "Payout batches with provider, amount and reference.",
    scope: "payouts",
    fields: [
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      { name: "amount", type: "currency", required: true, example: "1820.00" },
      { name: "currency", type: "string", required: true, example: "USD" },
      { name: "method", type: "enum", required: true, example: "bank", enumValues: ["bank", "paypal", "wise", "stripe", "crypto"] },
      { name: "reference", type: "string", required: false, example: "PAY-2026-07-0042" },
      { name: "scheduled_for", type: "date", required: false, example: "2026-07-05" },
      { name: "note", type: "string", required: false, example: "July run." },
    ],
    exportColumns: ["id", "affiliate", "amount", "currency", "method", "status", "reference", "scheduled_for", "completed_at"],
  },
];

export function getDataset(id: DatasetSpec["id"]) {
  return DATASETS.find((d) => d.id === id)!;
}

// CSV template generator
export function buildCsvTemplate(spec: DatasetSpec): string {
  const header = spec.fields.map((f) => f.name).join(",");
  const example = spec.fields
    .map((f) => {
      const v = f.example ?? "";
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(",");
  return `${header}\n${example}\n`;
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
