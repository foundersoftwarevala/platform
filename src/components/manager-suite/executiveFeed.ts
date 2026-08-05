// Role-specific seed data for the Executive Action Center banner.
// Replace `items` with live API data when the backend is connected.
export type AlertPriority = "critical" | "high" | "medium" | "low";

export type ExecAlert = {
  id: string;
  priority: AlertPriority;
  kind: string;
  title: string;
  detail: string;
  target: string;
  count?: number;
  progress?: number;
  due?: string;
};

export type ExecRole =
  | "influencer"
  | "creator"
  | "franchise"
  | "reseller"
  | "marketplace"
  | "seo"
  | "finance"
  | "lead";

export const executiveFeeds: Record<ExecRole, ExecAlert[]> = {
  influencer: [
    { id: "i1", priority: "critical", kind: "Approval Queue", title: "8 influencer applications waiting", detail: "3 flagged for KYC review", target: "Applications", count: 8, progress: 35, due: "Today 6:00 PM" },
    { id: "i2", priority: "high", kind: "Content Review", title: "14 posts awaiting approval", detail: "5 campaign deliverables due today", target: "Content Approval", count: 14, progress: 52, due: "Today" },
    { id: "i3", priority: "high", kind: "Contracts", title: "2 contracts expiring in 5 days", detail: "Renew or renegotiate brand terms", target: "Contracts", count: 2, progress: 70, due: "In 5 days" },
    { id: "i4", priority: "medium", kind: "Commissions", title: "Commission run pending release", detail: "₹4.2L across 26 influencers", target: "Commissions", progress: 80 },
    { id: "i5", priority: "medium", kind: "Verification", title: "6 profile verifications open", detail: "Social handles need re-check", target: "Verification", count: 6, progress: 45 },
    { id: "i6", priority: "low", kind: "AI Suggestion", title: "Shift 3 campaigns to Saturday", detail: "Predicted +18% engagement lift", target: "AI Studio" },
  ],
  creator: [
    { id: "c1", priority: "critical", kind: "Approval Queue", title: "5 creator applications pending", detail: "2 missing payout details", target: "Applications", count: 5, progress: 40, due: "Today" },
    { id: "c2", priority: "high", kind: "Content Review", title: "11 assets awaiting approval", detail: "Campaign go-live tomorrow", target: "Content Approval", count: 11, progress: 60, due: "Tomorrow" },
    { id: "c3", priority: "high", kind: "Payouts", title: "Payout batch ready to approve", detail: "18 creators in this cycle", target: "Payouts", progress: 75 },
    { id: "c4", priority: "medium", kind: "Performance", title: "4 creators below target", detail: "Coaching plan recommended", target: "Performance", count: 4, progress: 30 },
    { id: "c5", priority: "low", kind: "AI Suggestion", title: "Bundle top 3 products into one brief", detail: "Higher conversion on combos", target: "AI Studio" },
  ],
  franchise: [
    { id: "f1", priority: "critical", kind: "Approval Queue", title: "6 franchise applications in queue", detail: "2 territory conflicts detected", target: "Applications", count: 6, progress: 30, due: "Today 5:00 PM" },
    { id: "f2", priority: "critical", kind: "Territory", title: "Territory overlap: Pune / Nashik", detail: "Resolve before agreement signing", target: "Regions", progress: 20 },
    { id: "f3", priority: "high", kind: "Licensing", title: "4 licenses renew in 14 days", detail: "Renewal invoices not yet sent", target: "License", count: 4, progress: 55, due: "In 14 days" },
    { id: "f4", priority: "high", kind: "Royalty", title: "Royalty pending from 9 franchises", detail: "₹12.6L outstanding this cycle", target: "Royalty", count: 9, progress: 62 },
    { id: "f5", priority: "medium", kind: "Compliance", title: "3 compliance checks overdue", detail: "KYC + agreement copies missing", target: "Compliance", count: 3, progress: 44 },
    { id: "f6", priority: "low", kind: "Expansion", title: "2 high-potential regions unclaimed", detail: "Lead density above threshold", target: "Leads" },
  ],
  reseller: [
    { id: "r1", priority: "critical", kind: "Approval Queue", title: "12 reseller registrations pending", detail: "4 awaiting KYC verification", target: "Applications", count: 12, progress: 38, due: "Today" },
    { id: "r2", priority: "high", kind: "Commissions", title: "Commission payouts pending", detail: "₹3.8L across 31 resellers", target: "Commissions", progress: 66 },
    { id: "r3", priority: "high", kind: "Licensing", title: "7 license renewals this month", detail: "Send renewal reminders", target: "License", count: 7, progress: 50, due: "This month" },
    { id: "r4", priority: "medium", kind: "Targets", title: "Q-target at 72% attainment", detail: "9 days left in the cycle", target: "Performance", progress: 72, due: "In 9 days" },
    { id: "r5", priority: "medium", kind: "Support", title: "5 escalated reseller tickets", detail: "SLA breach risk in 4 hours", target: "Support Desk", count: 5, progress: 25, due: "In 4 hours" },
    { id: "r6", priority: "low", kind: "Wallet", title: "Wallet reconciliation ready", detail: "Auto-matched 96% of entries", target: "Wallet", progress: 96 },
  ],
  marketplace: [
    { id: "m1", priority: "critical", kind: "Approval Queue", title: "17 products pending approval", detail: "6 missing compliance docs", target: "Products", count: 17, progress: 42, due: "Today" },
    { id: "m2", priority: "high", kind: "Vendors", title: "9 vendor requests open", detail: "3 awaiting store verification", target: "Vendors", count: 9, progress: 55 },
    { id: "m3", priority: "high", kind: "Homepage", title: "Banner schedule gap tomorrow", detail: "No slide scheduled for 10:00 AM", target: "Hero Banner", progress: 30, due: "Tomorrow" },
    { id: "m4", priority: "medium", kind: "Inventory", title: "23 listings low on stock", detail: "Auto-hide threshold in 2 days", target: "Inventory", count: 23, progress: 61 },
    { id: "m5", priority: "medium", kind: "SEO", title: "12 pages missing meta description", detail: "Indexing impact: medium", target: "SEO", count: 12, progress: 48 },
    { id: "m6", priority: "low", kind: "Revenue", title: "GMV up 9.4% week over week", detail: "Driven by software category", target: "Analytics" },
  ],
  seo: [
    { id: "s1", priority: "critical", kind: "Warnings", title: "4 pages returning crawl errors", detail: "Blocking indexation on key routes", target: "Site Health", count: 4, progress: 20, due: "Today" },
    { id: "s2", priority: "high", kind: "Rankings", title: "6 keywords slipped out of top 10", detail: "Refresh content and internal links", target: "Google Ranking", count: 6, progress: 45 },
    { id: "s3", priority: "high", kind: "Content", title: "8 briefs waiting for approval", detail: "AI drafts ready to review", target: "AI Writer", count: 8, progress: 58 },
    { id: "s4", priority: "medium", kind: "Backlinks", title: "3 toxic backlinks detected", detail: "Consider disavow submission", target: "Backlinks", count: 3, progress: 33 },
    { id: "s5", priority: "low", kind: "AI Suggestion", title: "Cluster 14 keywords into 3 hubs", detail: "Projected +21% organic reach", target: "Keyword Center" },
  ],
  finance: [
    { id: "n1", priority: "critical", kind: "Payments", title: "9 invoices overdue", detail: "₹18.4L past due date", target: "Invoices", count: 9, progress: 25, due: "Overdue" },
    { id: "n2", priority: "high", kind: "Approvals", title: "12 expense approvals waiting", detail: "4 above auto-approve limit", target: "Expenses", count: 12, progress: 50, due: "Today" },
    { id: "n3", priority: "high", kind: "Reconciliation", title: "Wallet reconciliation pending", detail: "7 unmatched settlement lines", target: "Wallet", progress: 72 },
    { id: "n4", priority: "medium", kind: "Tax", title: "GST filing due in 6 days", detail: "Prepare returns and challans", target: "Tax", progress: 40, due: "In 6 days" },
    { id: "n5", priority: "low", kind: "Anomaly", title: "Refund rate up 1.8%", detail: "Concentrated in one category", target: "Refunds" },
  ],
  lead: [
    { id: "l1", priority: "critical", kind: "Today's Actions", title: "14 follow-ups due today", detail: "6 are hot leads over 80 score", target: "Leads", count: 14, progress: 35, due: "Today" },
    { id: "l2", priority: "high", kind: "Meetings", title: "3 meetings scheduled today", detail: "Next call in 45 minutes", target: "Calendar", count: 3, progress: 60, due: "In 45 min" },
    { id: "l3", priority: "high", kind: "Proposals", title: "7 proposals awaiting send-out", detail: "Pricing approved for 5", target: "Proposals", count: 7, progress: 55 },
    { id: "l4", priority: "medium", kind: "Conversion", title: "Pipeline conversion at 21%", detail: "Down 2 points week over week", target: "Analytics", progress: 21 },
    { id: "l5", priority: "low", kind: "AI Suggestion", title: "Re-engage 22 dormant leads", detail: "Best send window: 11:00 AM", target: "AI Studio" },
  ],
};