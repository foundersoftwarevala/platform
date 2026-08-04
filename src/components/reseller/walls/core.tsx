import {
  Archive, Building2, CheckCircle2, Clock, DollarSign, KeyRound, Package, Pause,
  ShieldAlert, ShoppingCart, Trash2, TrendingUp, UserCheck, Users,
} from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
const RS_STATUS = ["pending", "active", "suspended", "rejected"] as const;
const KYC = ["unverified", "submitted", "verified", "rejected"] as const;

export const resellersConfig: WallConfig = {
  scope: "resellers",
  entity: "reseller",
  eyebrow: "Network",
  title: "Resellers Wall",
  subtitle: "Directory of every reseller — search, filter, onboard and act with full audit.",
  icon: Users,
  primaryLabel: "New Reseller",
  seed: [],
  columns: [
    { key: "name", header: "Reseller", render: (r) => <div className="font-semibold">{r.name}</div> },
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-[11.5px]">{r.code}</span> },
    { key: "tier", header: "Tier", render: (r) => <StatusPill value={r.tier} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
    { key: "kyc_status", header: "KYC", render: (r) => <StatusPill value={r.kyc_status} /> },
    { key: "region", header: "Region" },
  ],
  filters: [
    { key: "status", label: "Status", options: RS_STATUS },
    { key: "tier", label: "Tier", options: TIERS },
    { key: "kyc_status", label: "KYC", options: KYC },
  ],
  kpis: [
    { label: "Total", hint: "In directory", icon: Users, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", hint: "Selling now", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Pending", hint: "Awaiting approval", icon: ShieldAlert, compute: (r) => (r.length ? r.filter((x) => x.status === "pending").length : "—") },
    { label: "KYC Verified", hint: "Fully compliant", icon: UserCheck, compute: (r) => (r.length ? r.filter((x) => x.kyc_status === "verified").length : "—") },
  ],
  bulkActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspend", label: "Suspend", icon: Pause, patch: { status: "suspended" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "approve", label: "Approve", icon: CheckCircle2, patch: { status: "active" } },
    { key: "suspend", label: "Suspend", icon: Pause, patch: { status: "suspended" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Reseller Name", type: "text", required: true },
    { key: "code", label: "Partner Code", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "region", label: "Region", type: "text" },
    { key: "tier", label: "Tier", type: "select", options: TIERS, defaultValue: "bronze" },
    { key: "status", label: "Status", type: "select", options: RS_STATUS, defaultValue: "pending" },
    { key: "kyc_status", label: "KYC", type: "select", options: KYC, defaultValue: "unverified" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  searchFields: ["name", "code", "email", "region"],
  primaryField: "name",
  subField: "code",
};

const SEGMENTS = ["individual", "sme", "enterprise"] as const;
const CU_STATUS = ["active", "inactive", "blocked"] as const;

export const customersConfig: WallConfig = {
  scope: "customers",
  entity: "customer",
  eyebrow: "Network",
  title: "Customers Wall",
  subtitle: "Every end customer in the channel — segment, owning reseller and lifetime value.",
  icon: Users,
  primaryLabel: "New Customer",
  seed: [],
  columns: [
    { key: "name", header: "Customer", render: (r) => <div className="font-semibold">{r.name}</div> },
    { key: "company", header: "Company" },
    { key: "segment", header: "Segment", render: (r) => <StatusPill value={r.segment} /> },
    { key: "reseller", header: "Reseller" },
    { key: "ltv", header: "LTV", align: "right" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: CU_STATUS },
    { key: "segment", label: "Segment", options: SEGMENTS },
  ],
  kpis: [
    { label: "Total Customers", icon: Users, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", hint: "Currently buying", icon: UserCheck, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Organizations", hint: "Unique companies", icon: Building2, compute: (r) => (r.length ? new Set(r.map((x) => x.company)).size : "—") },
    { label: "Lifetime Value", hint: "All customers", icon: DollarSign, compute: (r) => (r.length ? `₹${r.reduce((s, x) => s + Number(x.ltv || 0), 0).toLocaleString()}` : "—") },
  ],
  bulkActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "block", label: "Block", icon: Pause, patch: { status: "blocked" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "activate", label: "Activate", icon: CheckCircle2, patch: { status: "active" } },
    { key: "block", label: "Block", icon: Pause, patch: { status: "blocked" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Customer Name", type: "text", required: true },
    { key: "company", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "segment", label: "Segment", type: "select", options: SEGMENTS, defaultValue: "sme" },
    { key: "reseller", label: "Owning Reseller", type: "text" },
    { key: "ltv", label: "Lifetime Value", type: "number", defaultValue: 0 },
    { key: "status", label: "Status", type: "select", options: CU_STATUS, defaultValue: "active" },
  ],
  searchFields: ["name", "company", "email", "reseller"],
  primaryField: "name",
  subField: "company",
};

const OR_STATUS = ["pending", "processing", "fulfilled", "cancelled"] as const;
const PAYMENTS = ["paid", "unpaid", "refunded"] as const;

export const ordersConfig: WallConfig = {
  scope: "reseller-orders",
  entity: "order",
  eyebrow: "Commerce",
  title: "Orders Wall",
  subtitle: "Channel orders end to end — fulfilment, payment state and revenue.",
  icon: ShoppingCart,
  primaryLabel: "New Order",
  seed: [],
  columns: [
    { key: "ref", header: "Order", render: (r) => <span className="font-mono text-[12px] font-semibold">{r.ref}</span> },
    { key: "customer", header: "Customer" },
    { key: "product", header: "Product" },
    { key: "qty", header: "Qty", align: "right" },
    { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold">₹{Number(r.amount || 0).toLocaleString()}</span> },
    { key: "payment", header: "Payment", render: (r) => <StatusPill value={r.payment} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: OR_STATUS },
    { key: "payment", label: "Payment", options: PAYMENTS },
  ],
  kpis: [
    { label: "Total Orders", icon: ShoppingCart, compute: (r) => (r.length ? r.length : "—") },
    { label: "Fulfilled", hint: "Completed", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "fulfilled").length : "—") },
    { label: "In Pipeline", hint: "Pending + processing", icon: Clock, compute: (r) => (r.length ? r.filter((x) => x.status === "pending" || x.status === "processing").length : "—") },
    { label: "Revenue", hint: "Paid orders", icon: DollarSign, compute: (r) => (r.length ? `₹${r.filter((x) => x.payment === "paid").reduce((s, x) => s + Number(x.amount || 0), 0).toLocaleString()}` : "—") },
  ],
  bulkActions: [
    { key: "fulfil", label: "Mark Fulfilled", icon: CheckCircle2, patch: { status: "fulfilled" } },
    { key: "cancel", label: "Cancel", icon: Pause, patch: { status: "cancelled" }, variant: "destructive" },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "fulfil", label: "Mark Fulfilled", icon: CheckCircle2, patch: { status: "fulfilled" } },
    { key: "paid", label: "Mark Paid", icon: DollarSign, patch: { payment: "paid" } },
  ],
  formFields: [
    { key: "ref", label: "Order Reference", type: "text", required: true, placeholder: "ORD-…" },
    { key: "customer", label: "Customer", type: "text", required: true },
    { key: "reseller", label: "Reseller", type: "text" },
    { key: "product", label: "Product", type: "text" },
    { key: "qty", label: "Quantity", type: "number", defaultValue: 1 },
    { key: "amount", label: "Amount", type: "number", defaultValue: 0 },
    { key: "payment", label: "Payment", type: "select", options: PAYMENTS, defaultValue: "unpaid" },
    { key: "status", label: "Status", type: "select", options: OR_STATUS, defaultValue: "pending" },
  ],
  searchFields: ["ref", "customer", "product", "reseller"],
  primaryField: "ref",
  subField: "customer",
};

const CATEGORIES = ["Software", "Hardware", "Service", "Subscription", "Bundle"] as const;
const PR_STATUS = ["draft", "active", "archived"] as const;
const LICENSES = ["subscription", "perpetual", "usage"] as const;

export const productsConfig: WallConfig = {
  scope: "reseller-products",
  entity: "product",
  eyebrow: "Catalog",
  title: "Products Wall",
  subtitle: "Channel catalog — SKUs, pricing, licensing model and inventory.",
  icon: Package,
  primaryLabel: "New Product",
  seed: [],
  columns: [
    { key: "name", header: "Product", render: (r) => <div className="font-semibold">{r.name}</div> },
    { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-[11.5px]">{r.sku}</span> },
    { key: "category", header: "Category", render: (r) => <StatusPill value={r.category} /> },
    { key: "price", header: "Price", align: "right", render: (r) => <span className="font-semibold">₹{Number(r.price || 0).toLocaleString()}</span> },
    { key: "stock", header: "Stock", align: "right" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: PR_STATUS },
    { key: "category", label: "Category", options: CATEGORIES },
    { key: "license_type", label: "License", options: LICENSES },
  ],
  kpis: [
    { label: "Total Products", hint: "In catalog", icon: Package, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active SKUs", hint: "Published", icon: ShoppingCart, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Drafts", hint: "Not live", icon: Archive, compute: (r) => (r.length ? r.filter((x) => x.status === "draft").length : "—") },
    { label: "Inventory Value", hint: "Price × stock", icon: TrendingUp, compute: (r) => (r.length ? `₹${r.reduce((s, x) => s + Number(x.price || 0) * Number(x.stock || 0), 0).toLocaleString()}` : "—") },
  ],
  bulkActions: [
    { key: "publish", label: "Publish", icon: CheckCircle2, patch: { status: "active" } },
    { key: "archive", label: "Archive", icon: Archive, patch: { status: "archived" } },
    { key: "delete", label: "Delete", icon: Trash2, variant: "destructive" },
  ],
  rowActions: [
    { key: "publish", label: "Publish", icon: CheckCircle2, patch: { status: "active" } },
    { key: "archive", label: "Archive", icon: Archive, patch: { status: "archived" }, destructive: true },
  ],
  formFields: [
    { key: "name", label: "Product Name", type: "text", required: true },
    { key: "sku", label: "SKU", type: "text", required: true },
    { key: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "Software" },
    { key: "license_type", label: "License Type", type: "select", options: LICENSES, defaultValue: "subscription" },
    { key: "price", label: "Price", type: "number", defaultValue: 0 },
    { key: "cost", label: "Cost", type: "number", defaultValue: 0 },
    { key: "stock", label: "Stock", type: "number", defaultValue: 0 },
    { key: "status", label: "Status", type: "select", options: PR_STATUS, defaultValue: "draft" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  searchFields: ["name", "sku", "category"],
  primaryField: "name",
  subField: "sku",
};

export const licenseKeysIcon = KeyRound;