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
    description:
      "Temporarily disable selected affiliates. Links continue tracking but commissions pause.",
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
  id: "affiliates" | "links" | "codes" | "campaigns" | "commissions" | "payouts";
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
      {
        name: "external_id",
        type: "string",
        required: false,
        example: "AFF-1042",
        notes: "Your existing ID for upserts.",
      },
      { name: "first_name", type: "string", required: true, example: "Ananya" },
      { name: "last_name", type: "string", required: true, example: "Mehta" },
      { name: "email", type: "email", required: true, example: "ananya@partner.io" },
      {
        name: "country",
        type: "string",
        required: true,
        example: "IN",
        notes: "ISO 3166-1 alpha-2.",
      },
      {
        name: "tier",
        type: "enum",
        required: false,
        example: "gold",
        enumValues: ["bronze", "silver", "gold", "platinum"],
      },
      {
        name: "status",
        type: "enum",
        required: false,
        example: "active",
        enumValues: ["pending", "active", "suspended", "terminated"],
      },
      {
        name: "payout_method",
        type: "enum",
        required: false,
        example: "bank",
        enumValues: ["bank", "paypal", "wise", "stripe", "crypto"],
      },
      { name: "payout_currency", type: "string", required: false, example: "USD" },
      {
        name: "tags",
        type: "string",
        required: false,
        example: "saas;india;top-10",
        notes: "Semicolon separated.",
      },
    ],
    exportColumns: [
      "id",
      "external_id",
      "first_name",
      "last_name",
      "email",
      "country",
      "tier",
      "status",
      "joined_at",
      "sales_30d",
      "revenue_30d",
      "commission_pending",
      "commission_paid_ytd",
    ],
  },
  {
    id: "links",
    label: "Affiliate Links",
    description: "Tracking links with destination URL, UTM, and ownership.",
    scope: "links",
    fields: [
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      {
        name: "slug",
        type: "code",
        required: true,
        example: "ananya-q3",
        notes: "URL-safe, unique.",
      },
      {
        name: "destination_url",
        type: "url",
        required: true,
        example: "https://softwarevala.com/pricing",
      },
      { name: "campaign", type: "string", required: false, example: "q3-launch" },
      { name: "utm_source", type: "string", required: false, example: "newsletter" },
      { name: "utm_medium", type: "string", required: false, example: "email" },
      { name: "utm_campaign", type: "string", required: false, example: "q3-launch" },
      { name: "expires_at", type: "date", required: false, example: "2026-12-31" },
    ],
    exportColumns: [
      "id",
      "slug",
      "affiliate",
      "destination_url",
      "campaign",
      "clicks",
      "uniques",
      "conversions",
      "revenue",
      "created_at",
    ],
  },
  {
    id: "codes",
    label: "Referral Codes",
    description: "Discount and tracking codes assigned to affiliates.",
    scope: "codes",
    fields: [
      {
        name: "code",
        type: "code",
        required: true,
        example: "ANANYA20",
        notes: "Unique, A-Z 0-9 -.",
      },
      { name: "affiliate_external_id", type: "string", required: true, example: "AFF-1042" },
      {
        name: "discount_type",
        type: "enum",
        required: true,
        example: "percent",
        enumValues: ["percent", "fixed", "trial"],
      },
      { name: "discount_value", type: "number", required: true, example: "20" },
      { name: "max_redemptions", type: "number", required: false, example: "500" },
      { name: "starts_at", type: "date", required: false, example: "2026-07-01" },
      { name: "expires_at", type: "date", required: false, example: "2026-12-31" },
    ],
    exportColumns: [
      "code",
      "affiliate",
      "discount_type",
      "discount_value",
      "redemptions",
      "revenue",
      "status",
      "expires_at",
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Marketing programs with budget, products, schedule and approval.",
    scope: "campaigns",
    fields: [
      { name: "name", type: "string", required: true, example: "Q3 Launch" },
      { name: "owner_email", type: "email", required: true, example: "ops@softwarevala.com" },
      {
        name: "products",
        type: "string",
        required: false,
        example: "SKU-001;SKU-014",
        notes: "Semicolon separated SKUs.",
      },
      { name: "budget", type: "currency", required: false, example: "50000.00" },
      { name: "currency", type: "string", required: false, example: "USD" },
      { name: "starts_at", type: "date", required: true, example: "2026-07-01" },
      { name: "ends_at", type: "date", required: true, example: "2026-09-30" },
      {
        name: "status",
        type: "enum",
        required: false,
        example: "draft",
        enumValues: ["draft", "scheduled", "live", "paused", "ended"],
      },
    ],
    exportColumns: [
      "id",
      "name",
      "owner",
      "budget",
      "spent",
      "affiliates",
      "revenue",
      "status",
      "starts_at",
      "ends_at",
    ],
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
      {
        name: "type",
        type: "enum",
        required: true,
        example: "accrual",
        enumValues: ["accrual", "adjustment", "reversal", "bonus"],
      },
      { name: "period", type: "string", required: false, example: "2026-06", notes: "YYYY-MM." },
      {
        name: "note",
        type: "string",
        required: false,
        example: "Manual adjustment for chargeback.",
      },
    ],
    exportColumns: [
      "id",
      "affiliate",
      "order",
      "plan",
      "amount",
      "currency",
      "type",
      "status",
      "period",
      "created_at",
    ],
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
      {
        name: "method",
        type: "enum",
        required: true,
        example: "bank",
        enumValues: ["bank", "paypal", "wise", "stripe", "crypto"],
      },
      { name: "reference", type: "string", required: false, example: "PAY-2026-07-0042" },
      { name: "scheduled_for", type: "date", required: false, example: "2026-07-05" },
      { name: "note", type: "string", required: false, example: "July run." },
    ],
    exportColumns: [
      "id",
      "affiliate",
      "amount",
      "currency",
      "method",
      "status",
      "reference",
      "scheduled_for",
      "completed_at",
    ],
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

// ---------------- CSV parsing and validation ----------------

/** Parses CSV text (RFC 4180: quoted fields, doubled quotes, CRLF or LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines carry no data.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export type RowIssue = {
  row: number; // 1-based data row (the header is row 0)
  field: string;
  severity: "error" | "warning";
  message: string;
};

export type ValidationResult = {
  header: string[];
  parsed: number;
  valid: number;
  warnings: number;
  errors: number;
  missingColumns: string[];
  unknownColumns: string[];
  issues: RowIssue[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Za-z0-9_-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function checkValue(spec: FieldSpec, value: string): string | null {
  switch (spec.type) {
    case "email":
      return EMAIL_RE.test(value) ? null : "not a valid e-mail address";
    case "url":
      try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:" ? null : "must be an http(s) URL";
      } catch {
        return "not a valid URL";
      }
    case "number":
    case "currency":
      return value !== "" && Number.isFinite(Number(value)) ? null : "not a number";
    case "date":
      return DATE_RE.test(value) && !Number.isNaN(Date.parse(value))
        ? null
        : "not a date (YYYY-MM-DD)";
    case "boolean":
      return /^(true|false|yes|no|1|0)$/i.test(value) ? null : "must be true or false";
    case "enum":
      return spec.enumValues?.includes(value.toLowerCase())
        ? null
        : `must be one of ${(spec.enumValues ?? []).join(", ")}`;
    case "code":
      return CODE_RE.test(value) ? null : "may contain only letters, digits, - and _";
    default:
      return null;
  }
}

/** Checks every data row of a parsed CSV against the dataset schema. */
export function validateRows(spec: DatasetSpec, rows: string[][]): ValidationResult {
  const [rawHeader = [], ...data] = rows;
  const header = rawHeader.map((h) => h.trim());
  const known = new Set(spec.fields.map((f) => f.name));
  const missingColumns = spec.fields
    .filter((f) => f.required && !header.includes(f.name))
    .map((f) => f.name);
  const unknownColumns = header.filter((h) => h !== "" && !known.has(h));
  const issues: RowIssue[] = [];
  let valid = 0;
  let warnings = 0;
  let errors = 0;

  data.forEach((cells, i) => {
    const rowNo = i + 1;
    let rowError = false;
    let rowWarning = false;
    if (cells.length !== header.length) {
      issues.push({
        row: rowNo,
        field: "",
        severity: "warning",
        message: `has ${cells.length} columns, the header has ${header.length}`,
      });
      rowWarning = true;
    }
    for (const spec_ of spec.fields) {
      const at = header.indexOf(spec_.name);
      const value = at >= 0 ? (cells[at] ?? "").trim() : "";
      if (value === "") {
        if (spec_.required) {
          issues.push({ row: rowNo, field: spec_.name, severity: "error", message: "is required" });
          rowError = true;
        }
        continue;
      }
      const problem = checkValue(spec_, value);
      if (problem) {
        issues.push({ row: rowNo, field: spec_.name, severity: "error", message: problem });
        rowError = true;
      }
    }
    if (rowError) errors += 1;
    else if (rowWarning) warnings += 1;
    if (!rowError) valid += 1;
  });

  return {
    header,
    parsed: data.length,
    valid,
    warnings,
    errors,
    missingColumns,
    unknownColumns,
    issues,
  };
}

/** The issues as a CSV, for the "Download error report" action. */
export function buildErrorReportCsv(result: ValidationResult): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ["row,field,severity,message"];
  for (const c of result.missingColumns)
    lines.push(["header", c, "error", "required column is missing"].map(esc).join(","));
  for (const i of result.issues)
    lines.push([i.row, i.field, i.severity, i.message].map(esc).join(","));
  return `${lines.join("\n")}\n`;
}
