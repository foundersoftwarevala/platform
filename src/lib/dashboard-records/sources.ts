/**
 * Where each role dashboard module's records come from.
 *
 * Every module without a screen of its own fell back to a generic workspace
 * whose records lived in the browser's memory: anything created there was gone
 * on reload and nothing ever reached the platform. Each module is now one of:
 *
 *   records  read from the platform, scoped to the signed-in partner, by
 *            listDashboardRecords() in records.functions.ts
 *   route    the platform already has a full screen for it - the dashboard
 *            opens that screen rather than keeping a second copy
 *   module   another module on the same dashboard does this job
 *   none     the platform keeps no record of this; the module says so
 *
 * This file holds no server code, so the browser can read it to decide what
 * to render.
 */

export type AmountKind = "money" | "count" | "percent" | "none";

export type ModuleSource =
  | { kind: "records"; amountLabel: string; amountKind: AmountKind; ownerLabel?: string; categoryLabel?: string }
  | { kind: "route"; to: string; label: string }
  | { kind: "module"; key: string; label: string }
  | { kind: "none"; reason: string };

const money = (amountLabel = "Amount"): ModuleSource => ({ kind: "records", amountLabel, amountKind: "money" });
const count = (amountLabel: string): ModuleSource => ({ kind: "records", amountLabel, amountKind: "count" });
const plain = (): ModuleSource => ({ kind: "records", amountLabel: "", amountKind: "none" });
const none = (reason: string): ModuleSource => ({ kind: "none", reason });
const route = (to: string, label: string): ModuleSource => ({ kind: "route", to, label });
const aiChat: ModuleSource = { kind: "module", key: "ai-chat", label: "AI Assistant" };
const reports = none(
  "There is no separate report store. Each module exports its own records - open one and use Export.",
);

export const MODULE_SOURCES: Record<string, Record<string, ModuleSource>> = {
  author: {
    products: money("Price"),
    downloads: plain(),
    sales: money("Line total"),
    revenue: money("Your share"),
    reviews: count("Rating"),
    followers: none("The platform has no follower model: buyers cannot follow an author yet."),
  },
  vendor: {
    products: money("Price"),
    orders: money("Your lines"),
    revenue: money("Your share"),
    customers: count("Paid orders"),
    returns: money("Reversed"),
    inventory: none("Products on the marketplace are software, and no stock is kept for them."),
    analytics: count("Events"),
    marketing: none("Coupons on the marketplace are the platform's own; a vendor cannot run a campaign yet."),
    reports,
  },
  reseller: {
    commissions: money("Commission"),
    revenue: money("Order total"),
    renewals: plain(),
    rank: count("Score"),
    reports,
  },
  affiliate: {
    clicks: count("Clicks"),
    conversions: money("Order total"),
    commissions: money("Commission"),
    campaigns: none("No affiliate campaign has been set up on the platform."),
    payouts: money("Payout"),
    rank: count("Score"),
    marketing: plain(),
    ai: aiChat,
    reports,
  },
  influencer: {
    followers: count("Followers"),
    campaigns: plain(),
    brands: none("The platform keeps no brand deals yet."),
    content: none("The platform keeps no content library for influencers yet."),
    revenue: money("Net"),
    engagement: { kind: "records", amountLabel: "Engagement", amountKind: "percent" },
  },
  franchise: {
    performance: money("Revenue"),
    growth: none("Growth is read from Performance, period on period; there is no separate growth record."),
    ai: aiChat,
    reports,
  },
  seo: {
    projects: route("/seo-manager", "SEO Manager"),
    keywords: count("Position"),
    traffic: count("Clicks"),
    backlinks: count("Domain authority"),
    audits: count("Score"),
    rankings: count("Position"),
    tools: route("/seo-manager", "SEO Manager"),
    ai: aiChat,
    reports: plain(),
  },
  // The admin dashboard's modules each have a full Manager in the Control
  // Panel; a second, smaller copy of the same data here would only disagree.
  admin: {
    users: none("There is no user administration screen yet. Roles are granted through the Application Manager."),
    orders: route("/marketplace-manager", "Marketplace Manager"),
    revenue: route("/finance-manager", "Finance Manager"),
    products: route("/marketplace-manager", "Marketplace Manager"),
    tickets: route("/support", "Customer Support"),
    approvals: route("/application-manager", "Application Manager"),
  },
  developer: {
    "command-center": route("/dev-manager", "Dev Manager"),
    tasks: money("Task amount"),
    bugs: plain(),
    "code-submission": plain(),
    timer: route("/task-manager", "Task Manager"),
    ai: aiChat,
    performance: route("/dev-manager", "Dev Manager"),
    wallet: none("No developer wallet exists on the platform yet."),
    chat: route("/chat", "Connect Chat"),
    settings: none("There is no account settings screen for developers yet."),
  },
};

/** The Dev Manager and the Promise Tracker are full screens of their own. */
const DEV_MANAGER: ModuleSource = route("/dev-manager", "Dev Manager");
const PROMISE: Record<string, string> = {
  overview: "/promise-tracker",
  all: "/promise-tracker/all",
  create: "/promise-tracker/create",
  categories: "/promise-tracker/categories",
  active: "/promise-tracker/active",
  delayed: "/promise-tracker/delayed",
  broken: "/promise-tracker/broken",
  fulfilled: "/promise-tracker/fulfilled",
  escalations: "/promise-tracker/escalations",
  audit: "/promise-tracker/audit-logs",
  settings: "/promise-tracker/settings",
  ai: "/promise-tracker/insights",
  sla: "/promise-tracker/rules",
  "fine-tip": "/promise-tracker/rules",
};

export function sourceFor(role: string, module: string): ModuleSource {
  if (role === "dev-manager") return DEV_MANAGER;
  if (role === "promise-tracker") {
    // The category modules (sales, support, delivery, ...) are the register,
    // which is filtered by category on its own screen.
    return route(PROMISE[module] ?? "/promise-tracker/all", "Promise Tracker");
  }
  return (
    MODULE_SOURCES[role]?.[module] ??
    none("This module is not connected to any record on the platform yet.")
  );
}
