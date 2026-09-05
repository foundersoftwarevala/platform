import { AFFILIATE_NAV } from "./affiliate-nav";

export type SearchEntityKind =
  | "Wall"
  | "Affiliate"
  | "Application"
  | "Campaign"
  | "Link"
  | "Code"
  | "Lead"
  | "Customer"
  | "Product"
  | "Coupon"
  | "Sale"
  | "Order"
  | "Commission"
  | "Payout"
  | "Wallet"
  | "Report"
  | "Document"
  | "Ticket"
  | "Message"
  | "Action"
  | "Setting"
  | "Filter"
  | "KPI";

export type SearchableItem = {
  id: string;
  kind: SearchEntityKind;
  title: string;
  subtitle?: string;
  keywords: string[];
  to: string;
  wall: string; // wall label
  group: string;
};

const wallByPath = Object.fromEntries(AFFILIATE_NAV.map((n) => [n.to, n]));

const wallItems: SearchableItem[] = AFFILIATE_NAV.map((n) => ({
  id: `wall:${n.to}`,
  kind: "Wall",
  title: n.label,
  subtitle: `Open the ${n.label} workspace`,
  keywords: [n.label, n.group, "wall", "workspace", "navigate", "open"],
  to: n.to,
  wall: n.label,
  group: n.group,
}));

// Entity catalog: what each wall can hold. No mock records — these are
// searchable entity types / quick-access shortcuts that route to the wall.
const catalog: Array<Omit<SearchableItem, "id" | "wall" | "group">> = [
  // Affiliates
  { kind: "Affiliate", title: "Affiliate Directory", subtitle: "All affiliates, partners, creators", keywords: ["affiliate", "partner", "creator", "publisher", "influencer", "directory", "roster"], to: "/affiliate-manager/affiliates" },
  { kind: "Filter", title: "Top Performers", subtitle: "Affiliates · saved view", keywords: ["top", "best", "performers", "revenue", "leaderboard"], to: "/affiliate-manager/affiliates" },
  { kind: "Filter", title: "At Risk Affiliates", subtitle: "Affiliates · health filter", keywords: ["risk", "churn", "inactive", "fraud", "warning"], to: "/affiliate-manager/affiliates" },
  { kind: "Filter", title: "Verified Affiliates", subtitle: "Affiliates · KYC", keywords: ["verified", "kyc", "approved", "trusted"], to: "/affiliate-manager/affiliates" },
  { kind: "Action", title: "Add Affiliate", subtitle: "Create new affiliate record", keywords: ["new", "add", "create", "invite", "onboard", "affiliate"], to: "/affiliate-manager/affiliates" },
  { kind: "Action", title: "Import Affiliates (CSV)", subtitle: "Bulk import", keywords: ["import", "upload", "csv", "bulk", "affiliates"], to: "/affiliate-manager/affiliates" },

  // Applications
  { kind: "Application", title: "Pending Applications", subtitle: "Applications queue", keywords: ["pending", "applications", "queue", "review", "approve"], to: "/affiliate-manager/applications" },
  { kind: "Action", title: "Approve KYC Queue", subtitle: "Run compliance approvals", keywords: ["kyc", "approve", "compliance", "queue"], to: "/affiliate-manager/applications" },

  // Referral network
  { kind: "Wall", title: "Multi-Tier Referral Network", subtitle: "Tree, depth, overrides", keywords: ["mlm", "multi", "tier", "tree", "downline", "upline", "network", "referral"], to: "/affiliate-manager/referral-network" },

  // Links & Codes
  { kind: "Link", title: "Affiliate Links", subtitle: "Tracking URLs and deep links", keywords: ["url", "link", "tracking", "utm", "deeplink", "short"], to: "/affiliate-manager/affiliate-links" },
  { kind: "Action", title: "Generate Tracking Link", subtitle: "Create a new affiliate URL", keywords: ["generate", "create", "tracking", "link", "url"], to: "/affiliate-manager/affiliate-links" },
  { kind: "Code", title: "Referral Codes", subtitle: "Shareable codes & vanity codes", keywords: ["code", "referral", "vanity", "promo"], to: "/affiliate-manager/referral-codes" },
  { kind: "Action", title: "Generate Referral Codes", subtitle: "Bulk-create codes", keywords: ["generate", "bulk", "codes", "create"], to: "/affiliate-manager/referral-codes" },

  // Campaigns / Marketing
  { kind: "Campaign", title: "Campaigns", subtitle: "Programs, offers, contests", keywords: ["campaign", "program", "offer", "contest", "launch"], to: "/affiliate-manager/campaigns" },
  { kind: "Action", title: "Launch Campaign", subtitle: "Start a new campaign", keywords: ["launch", "new", "campaign", "create"], to: "/affiliate-manager/campaigns" },
  { kind: "Wall", title: "Marketing Assets", subtitle: "Banners, swipe copy, creatives", keywords: ["marketing", "assets", "creatives", "banner", "swipe", "media"], to: "/affiliate-manager/marketing" },

  // Leads / Customers
  { kind: "Lead", title: "Leads", subtitle: "Captured leads from partners", keywords: ["lead", "prospect", "capture", "form"], to: "/affiliate-manager/leads" },
  { kind: "Customer", title: "Customers", subtitle: "Referred customers", keywords: ["customer", "buyer", "user", "referred"], to: "/affiliate-manager/customers" },

  // Commerce
  { kind: "Product", title: "Products", subtitle: "Catalog & commission tiers", keywords: ["product", "catalog", "sku", "tier"], to: "/affiliate-manager/products" },
  { kind: "Wall", title: "Marketplace", subtitle: "Public offers marketplace", keywords: ["marketplace", "offers", "public", "discovery"], to: "/affiliate-manager/marketplace" },
  { kind: "Coupon", title: "Coupons", subtitle: "Discount codes attached to affiliates", keywords: ["coupon", "discount", "promo", "voucher"], to: "/affiliate-manager/coupons" },
  { kind: "Sale", title: "Sales", subtitle: "Attributed sales", keywords: ["sale", "transaction", "attribution", "conversion"], to: "/affiliate-manager/sales" },
  { kind: "Order", title: "Orders", subtitle: "Order ledger", keywords: ["order", "purchase", "ledger", "receipt"], to: "/affiliate-manager/orders" },

  // Finance
  { kind: "Commission", title: "Commissions", subtitle: "Earned, pending, reversed", keywords: ["commission", "earning", "payout", "rate", "cpa", "cps"], to: "/affiliate-manager/commissions" },
  { kind: "Action", title: "Adjust Commission", subtitle: "Override or recalculate", keywords: ["adjust", "override", "recalc", "commission"], to: "/affiliate-manager/commissions" },
  { kind: "Wallet", title: "Affiliate Wallets", subtitle: "Balances & ledger", keywords: ["wallet", "balance", "ledger", "funds"], to: "/affiliate-manager/wallet" },
  { kind: "Payout", title: "Payouts", subtitle: "Batch runs, bank transfers, PayPal", keywords: ["payout", "withdraw", "transfer", "bank", "paypal", "stripe"], to: "/affiliate-manager/payouts" },
  { kind: "Action", title: "Issue Payout", subtitle: "Run a payout batch", keywords: ["issue", "run", "payout", "batch", "send"], to: "/affiliate-manager/payouts" },

  // Ops
  { kind: "Wall", title: "Performance", subtitle: "Conversion, EPC, AOV", keywords: ["performance", "epc", "aov", "conversion", "metrics"], to: "/affiliate-manager/performance" },
  { kind: "Message", title: "Communication", subtitle: "Email, SMS, in-app broadcasts", keywords: ["message", "email", "sms", "broadcast", "notify"], to: "/affiliate-manager/communication" },
  { kind: "Ticket", title: "Support Tickets", subtitle: "Affiliate support queue", keywords: ["support", "ticket", "help", "issue"], to: "/affiliate-manager/support" },
  { kind: "Wall", title: "Compliance & Risk", subtitle: "Fraud, AML, GDPR", keywords: ["compliance", "fraud", "risk", "aml", "gdpr", "policy"], to: "/affiliate-manager/compliance" },
  { kind: "Document", title: "Documents & Contracts", subtitle: "Agreements, W-9, tax forms", keywords: ["document", "contract", "agreement", "tax", "w9", "w8", "vat"], to: "/affiliate-manager/documents" },

  // System
  { kind: "Wall", title: "Analytics", subtitle: "Cohorts, funnels, attribution", keywords: ["analytics", "cohort", "funnel", "attribution", "insight"], to: "/affiliate-manager/analytics" },
  { kind: "Report", title: "Reports", subtitle: "Scheduled & exported reports", keywords: ["report", "export", "scheduled", "csv", "pdf"], to: "/affiliate-manager/reports" },
  { kind: "Action", title: "Export Report", subtitle: "Download as CSV / PDF", keywords: ["export", "download", "csv", "pdf", "report"], to: "/affiliate-manager/reports" },
  { kind: "Setting", title: "Commission Rules", subtitle: "Settings · commission engine", keywords: ["settings", "commission", "rules", "engine", "rate"], to: "/affiliate-manager/settings" },
  { kind: "Setting", title: "Cookie & Attribution Window", subtitle: "Settings · attribution", keywords: ["settings", "cookie", "attribution", "window", "lookback"], to: "/affiliate-manager/settings" },
  { kind: "Setting", title: "Tax & Withholding", subtitle: "Settings · finance", keywords: ["settings", "tax", "withholding", "vat", "1099"], to: "/affiliate-manager/settings" },
  { kind: "Setting", title: "Roles & Permissions", subtitle: "Settings · access", keywords: ["settings", "roles", "rbac", "permissions", "access"], to: "/affiliate-manager/settings" },
  { kind: "Setting", title: "API & Webhooks", subtitle: "Settings · integrations", keywords: ["settings", "api", "webhook", "integration", "key"], to: "/affiliate-manager/settings" },
];

export const SEARCH_INDEX: SearchableItem[] = [
  ...wallItems,
  ...catalog.map((c, i) => {
    const wall = wallByPath[c.to];
    return {
      ...c,
      id: `cat:${i}:${c.to}`,
      wall: wall?.label ?? "—",
      group: wall?.group ?? "system",
    };
  }),
];

export const SEARCH_KINDS: SearchEntityKind[] = [
  "Wall", "Affiliate", "Application", "Campaign", "Link", "Code", "Lead",
  "Customer", "Product", "Coupon", "Sale", "Order", "Commission", "Payout",
  "Wallet", "Report", "Document", "Ticket", "Message", "Action", "Setting",
  "Filter", "KPI",
];

export const SEARCH_GROUPS = ["overview", "network", "growth", "commerce", "finance", "ops", "system"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export type SearchScope = {
  q: string;
  kinds?: SearchEntityKind[];
  groups?: SearchGroup[];
  wall?: string; // wall path
};

export type ScoredResult = SearchableItem & {
  score: number;
  matchedIn: "title" | "subtitle" | "keyword" | "wall";
};

export function runSearch(scope: SearchScope, limit = 200): ScoredResult[] {
  const q = scope.q.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const items = SEARCH_INDEX.filter((it) => {
    if (scope.kinds?.length && !scope.kinds.includes(it.kind)) return false;
    if (scope.groups?.length && !scope.groups.includes(it.group as SearchGroup)) return false;
    if (scope.wall && it.to !== scope.wall) return false;
    return true;
  });
  if (!terms.length) {
    return items.slice(0, limit).map((it) => ({ ...it, score: 0, matchedIn: "title" }));
  }
  const scored: ScoredResult[] = [];
  for (const it of items) {
    const title = it.title.toLowerCase();
    const sub = (it.subtitle ?? "").toLowerCase();
    const kw = it.keywords.join(" ").toLowerCase();
    const wall = it.wall.toLowerCase();
    let score = 0;
    let matchedIn: ScoredResult["matchedIn"] = "title";
    let matchedAll = true;
    for (const t of terms) {
      let hit = 0;
      if (title.startsWith(t)) hit = 100;
      else if (title.includes(t)) { hit = 60; matchedIn = "title"; }
      else if (sub.includes(t)) { hit = 30; matchedIn = "subtitle"; }
      else if (kw.includes(t)) { hit = 20; matchedIn = "keyword"; }
      else if (wall.includes(t)) { hit = 10; matchedIn = "wall"; }
      if (!hit) { matchedAll = false; break; }
      score += hit;
    }
    if (matchedAll) scored.push({ ...it, score, matchedIn });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export function highlight(text: string, q: string): Array<{ t: string; hit: boolean }> {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [{ t: text, hit: false }];
  const pattern = new RegExp(`(${terms.map(escapeReg).join("|")})`, "ig");
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((p) => ({ t: p, hit: pattern.test(p) && (pattern.lastIndex = 0, true) }));
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
