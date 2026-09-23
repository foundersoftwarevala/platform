import {
  Archive, Building2, CheckCircle2, Clock, DollarSign, KeyRound, Package, Pause,
  ShoppingCart, Trash2, TrendingUp, UserCheck, Users,
} from "lucide-react";

import { StatusPill, type WallConfig } from "@/components/manager-suite/wall";

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
const RS_STATUS = ["pending", "active", "suspended", "rejected"] as const;
const KYC = ["unverified", "submitted", "verified", "rejected"] as const;


const CU_STATUS = ["active", "inactive", "blocked"] as const;
const PLANS = ["basic", "pro", "enterprise"] as const;

/**
 * Customers, read and written on crm_customers.
 *
 * This wall showed whatever an operator typed into their own browser, while
 * crm_customers sat unread - so a client a reseller added on their dashboard
 * was invisible here, and anything added here was gone on reload.
 */
export const customersConfig: WallConfig = {
  resource: "customers",
  scope: "customers",
  entity: "customer",
  eyebrow: "Network",
  title: "Customers Wall",
  subtitle: "Every end customer in the channel — who owns them, what they are worth and how they are doing.",
  icon: Users,
  primaryLabel: "New Customer",
  seed: [],
  columns: [
    { key: "contact_name", header: "Customer", render: (r) => <div className="font-semibold">{r.contact_name || "—"}</div> },
    { key: "company_name", header: "Company", render: (r) => <span>{r.company_name || "—"}</span> },
    { key: "email", header: "Email", render: (r) => <span className="text-[12px]">{r.email || "—"}</span> },
    { key: "industry", header: "Industry", render: (r) => <span>{r.industry || "—"}</span> },
    { key: "plan", header: "Plan", render: (r) => <StatusPill value={r.plan} /> },
    { key: "health_score", header: "Health", align: "right", render: (r) => <span>{r.health_score == null ? "—" : `${r.health_score}%`}</span> },
    { key: "lifetime_value", header: "LTV", align: "right", render: (r) => <span className="font-semibold">{r.lifetime_value ? `₹${Number(r.lifetime_value).toLocaleString()}` : "—"}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [
    { key: "status", label: "Status", options: CU_STATUS },
    { key: "plan", label: "Plan", options: PLANS },
  ],
  kpis: [
    { label: "Total Customers", icon: Users, compute: (r) => (r.length ? r.length : "—") },
    { label: "Active", hint: "Currently buying", icon: UserCheck, compute: (r) => (r.length ? r.filter((x) => x.status === "active").length : "—") },
    { label: "Organizations", hint: "Unique companies", icon: Building2, compute: (r) => (r.length ? new Set(r.map((x) => x.company_name).filter(Boolean)).size : "—") },
    { label: "Lifetime Value", hint: "All customers", icon: DollarSign, compute: (r) => (r.length ? `₹${r.reduce((s, x) => s + Number(x.lifetime_value || 0), 0).toLocaleString()}` : "—") },
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
    { key: "contact_name", label: "Customer Name", type: "text", required: true },
    { key: "company_name", label: "Company", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "text" },
    { key: "industry", label: "Industry", type: "text" },
    { key: "country", label: "Country", type: "text" },
    { key: "plan", label: "Plan", type: "select", options: PLANS, defaultValue: "basic" },
    { key: "health_score", label: "Health (%)", type: "number", defaultValue: 80 },
    { key: "status", label: "Status", type: "select", options: CU_STATUS, defaultValue: "active" },
  ],
  searchFields: ["company_name", "contact_name", "email", "status"],
  primaryField: "contact_name",
  subField: "company_name",
};

const OR_STATUS = ["pending", "paid", "failed", "cancelled", "refunded"] as const;

/**
 * Orders, read on marketplace_orders.
 *
 * An order is created by a purchase, never by an operator typing one in, and
 * its money is not editable from a screen. What this wall carries is the one
 * decision an operator has: cancelling an order, or reinstating it.
 */
export const ordersConfig: WallConfig = {
  resource: "orders",
  creatable: false,
  scope: "reseller-orders",
  entity: "order",
  eyebrow: "Commerce",
  title: "Orders Wall",
  subtitle: "Channel orders end to end — payment state, gateway and revenue.",
  icon: ShoppingCart,
  primaryLabel: "New Order",
  seed: [],
  columns: [
    {
      key: "order_no", header: "Order",
      render: (r) => <span className="font-mono text-[12px] font-semibold">{r.order_no || r.order_number || "—"}</span>,
    },
    {
      key: "buyer_id", header: "Buyer",
      render: (r) => <span className="font-mono text-[11px]">{String(r.buyer_id ?? "—").slice(0, 8)}</span>,
    },
    {
      key: "total", header: "Amount", align: "right",
      render: (r) => <span className="font-semibold">{r.currency ?? ""} {Number(r.total ?? r.amount_inr ?? 0).toLocaleString()}</span>,
    },
    { key: "payment_gateway", header: "Gateway", render: (r) => <span>{r.payment_gateway || "—"}</span> },
    { key: "txnid", header: "Transaction", render: (r) => <span className="font-mono text-[11px]">{r.txnid || "—"}</span> },
    { key: "created_at", header: "Placed" },
    { key: "status", header: "Status", render: (r) => <StatusPill value={r.status} /> },
  ],
  filters: [{ key: "status", label: "Status", options: OR_STATUS }],
  kpis: [
    { label: "Total Orders", icon: ShoppingCart, compute: (r) => (r.length ? r.length : "—") },
    { label: "Paid", icon: CheckCircle2, compute: (r) => (r.length ? r.filter((x) => x.status === "paid").length : "—") },
    { label: "Awaiting Payment", icon: Clock, compute: (r) => (r.length ? r.filter((x) => x.status === "pending").length : "—") },
    {
      label: "Revenue", hint: "Paid orders", icon: DollarSign,
      compute: (r) => {
        const paid = r.filter((x) => x.status === "paid");
        return paid.length ? `₹${paid.reduce((s, x) => s + Number(x.total ?? x.amount_inr ?? 0), 0).toLocaleString()}` : "—";
      },
    },
  ],
  bulkActions: [
    {
      key: "cancel", label: "Cancel", icon: Pause, patch: { status: "cancelled" }, variant: "destructive",
      confirmTitle: "Cancel these orders?",
      confirmDescription: "The order stops being fulfilled. Nothing is refunded by this on its own.",
    },
  ],
  rowActions: [
    { key: "cancel", label: "Cancel", icon: Pause, patch: { status: "cancelled" }, destructive: true },
    { key: "reinstate", label: "Reinstate", icon: CheckCircle2, patch: { status: "pending" } },
  ],
  formFields: [{ key: "status", label: "Status", type: "select", options: OR_STATUS }],
  searchFields: ["order_no", "order_number", "txnid", "status"],
  primaryField: "order_no",
  subField: "status",
  statusField: "status",
};

const PR_STATUS = ["draft", "published", "archived"] as const;

/**
 * The catalogue a reseller sells from, read on marketplace_products.
 *
 * The wall used to invent its own SKUs and stock levels in the browser. It now
 * lists the real catalogue. Nothing here writes to it: what a product says and
 * whether it is published belongs to the Marketplace Manager and to the author
 * who uploaded it, not to the reseller console.
 */
export const productsConfig: WallConfig = {
  resource: "products",
  creatable: false,
  scope: "reseller-products",
  entity: "product",
  eyebrow: "Catalog",
  title: "Products Wall",
  subtitle: "The catalogue a reseller sells from — what is live, and what it costs.",
  icon: Package,
  primaryLabel: "New Product",
  seed: [],
  columns: [
    { key: "name", header: "Product", render: (r) => <div className="font-semibold">{r.name}</div> },
    { key: "slug", header: "Slug", render: (r) => <span className="font-mono text-[11.5px]">{r.slug}</span> },
    { key: "industry_label", header: "Industry", render: (r) => <span>{r.industry_label || "—"}</span> },
    { key: "price_label", header: "Price", align: "right", render: (r) => <span className="font-semibold">{r.price_label || "—"}</span> },
    { key: "downloads_label", header: "Downloads", align: "right", render: (r) => <span>{r.downloads_label || "—"}</span> },
    { key: "content_status", header: "Content", render: (r) => <StatusPill value={r.content_status} /> },
    { key: "visible", header: "Live", render: (r) => <StatusPill value={r.visible ? "published" : "draft"} /> },
  ],
  filters: [{ key: "content_status", label: "Content", options: PR_STATUS }],
  kpis: [
    { label: "Catalogue", hint: "Products in all", icon: Package, compute: (r) => (r.length ? r.length : "—") },
    { label: "Live", hint: "Visible to buyers", icon: ShoppingCart, compute: (r) => (r.length ? r.filter((x) => x.visible).length : "—") },
    { label: "Not Live", icon: Archive, compute: (r) => (r.length ? r.filter((x) => !x.visible).length : "—") },
    { label: "Industries", hint: "Distinct labels", icon: TrendingUp, compute: (r) => (r.length ? new Set(r.map((x) => x.industry_label).filter(Boolean)).size : "—") },
  ],
  bulkActions: [],
  rowActions: [],
  formFields: [],
  searchFields: ["name", "slug", "industry_label"],
  primaryField: "name",
  subField: "slug",
};

export const licenseKeysIcon = KeyRound;