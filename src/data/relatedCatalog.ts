import type { Demo } from "@/data/extraDemos";
import { LIFETIME_PRICE, MIN_ROW_CARDS } from "@/lib/marketplace-content/stats";

const SUB_MODULES: { suffix: string; desc: string; tags: string[] }[] = [
  { suffix: "Core Suite", desc: "All-in-one core platform with roles, workflows and dashboards.", tags: ["Workflows", "Roles", "Dashboard", "Audit"] },
  { suffix: "CRM", desc: "Lead capture, pipelines, follow-ups and customer 360.", tags: ["Leads", "Pipeline", "Tasks", "360 View"] },
  { suffix: "Billing & Invoicing", desc: "GST-ready invoicing, recurring billing and payment links.", tags: ["Invoices", "GST", "Recurring", "Payments"] },
  { suffix: "Inventory Manager", desc: "Multi-warehouse stock, batches, expiry and reorder alerts.", tags: ["Stock", "Batches", "Alerts", "Transfers"] },
  { suffix: "POS Terminal", desc: "Fast counter billing with offline mode and thermal printing.", tags: ["Counter", "Offline", "Printing", "Shifts"] },
  { suffix: "Booking Engine", desc: "Slot booking, availability calendar and instant confirmations.", tags: ["Slots", "Calendar", "Reminders", "Payments"] },
  { suffix: "Order Management", desc: "Order lifecycle, fulfilment states and returns handling.", tags: ["Orders", "Fulfilment", "Returns", "SLA"] },
  { suffix: "Payments Gateway Kit", desc: "Multi-gateway checkout, refunds and settlement reports.", tags: ["Checkout", "Refunds", "Settlements", "Webhooks"] },
  { suffix: "Accounting Ledger", desc: "Double-entry ledger, trial balance and P&L statements.", tags: ["Ledger", "P&L", "Trial Balance", "Exports"] },
  { suffix: "HRMS", desc: "Employee master, attendance, leave and payroll runs.", tags: ["Attendance", "Leave", "Payroll", "Docs"] },
  { suffix: "Payroll Engine", desc: "Salary structures, statutory deductions and payslips.", tags: ["Salary", "PF/ESI", "Payslips", "TDS"] },
  { suffix: "Attendance & Biometrics", desc: "Device sync, geo-fenced punches and shift rosters.", tags: ["Biometric", "Geo-fence", "Shifts", "Reports"] },
  { suffix: "Analytics Dashboard", desc: "Live KPIs, cohort trends and export-ready reporting.", tags: ["KPIs", "Trends", "Filters", "Exports"] },
  { suffix: "Reporting Studio", desc: "Drag-and-drop report builder with scheduled delivery.", tags: ["Builder", "Schedule", "Email", "PDF"] },
  { suffix: "Mobile App", desc: "Native-grade mobile experience for staff and customers.", tags: ["Android", "iOS", "Push", "Offline"] },
  { suffix: "Customer Portal", desc: "Self-service portal for orders, tickets and documents.", tags: ["Self-service", "Tickets", "Docs", "SSO"] },
  { suffix: "Vendor Portal", desc: "Supplier onboarding, POs, GRN and payout visibility.", tags: ["Onboarding", "PO", "GRN", "Payouts"] },
  { suffix: "Helpdesk & Tickets", desc: "Omnichannel ticketing with SLA timers and escalations.", tags: ["SLA", "Escalation", "Canned", "CSAT"] },
  { suffix: "Live Chat Widget", desc: "Website chat with routing, transcripts and bots.", tags: ["Routing", "Bots", "Transcripts", "Tags"] },
  { suffix: "WhatsApp Automation", desc: "Template broadcasts, drip flows and inbox for teams.", tags: ["Broadcast", "Flows", "Inbox", "Reports"] },
  { suffix: "Email & SMS Campaigns", desc: "Segments, journeys and delivery analytics.", tags: ["Segments", "Journeys", "A/B", "Analytics"] },
  { suffix: "Marketing Automation", desc: "Lead scoring, nurture flows and attribution.", tags: ["Scoring", "Nurture", "Attribution", "Forms"] },
  { suffix: "SEO & Content Hub", desc: "Content workflow, schema and keyword tracking.", tags: ["Content", "Schema", "Keywords", "Audit"] },
  { suffix: "Website Builder", desc: "Blocks, themes and one-click publishing.", tags: ["Blocks", "Themes", "Forms", "Publish"] },
  { suffix: "White Label Pack", desc: "Your brand, your domain, your pricing - fully rebrandable.", tags: ["Branding", "Domain", "Themes", "Rights"] },
  { suffix: "SaaS Multi-Tenant Edition", desc: "Tenant isolation, plans, metering and subscription billing.", tags: ["Tenants", "Plans", "Metering", "Billing"] },
  { suffix: "Franchise Console", desc: "Territory control, royalty tracking and outlet scorecards.", tags: ["Territory", "Royalty", "Outlets", "Scorecard"] },
  { suffix: "Reseller Console", desc: "Partner tiers, deal registration and commission ledger.", tags: ["Tiers", "Deals", "Commission", "Payouts"] },
  { suffix: "Affiliate Tracker", desc: "Links, cookies, conversions and payout automation.", tags: ["Links", "Conversions", "Payouts", "Fraud"] },
  { suffix: "Loyalty & Rewards", desc: "Points, tiers, coupons and referral engines.", tags: ["Points", "Tiers", "Coupons", "Referrals"] },
  { suffix: "Subscription Manager", desc: "Plans, trials, dunning and renewal forecasting.", tags: ["Plans", "Trials", "Dunning", "Renewals"] },
  { suffix: "Document Vault", desc: "Versioned documents, e-sign and expiry reminders.", tags: ["Versions", "E-sign", "Expiry", "Access"] },
  { suffix: "Compliance & Audit", desc: "Policy checklists, evidence trails and audit exports.", tags: ["Policies", "Evidence", "Trails", "Exports"] },
  { suffix: "Asset Management", desc: "Asset register, depreciation and maintenance schedules.", tags: ["Register", "Depreciation", "AMC", "QR"] },
  { suffix: "Field Force Tracker", desc: "Beat plans, live location and visit proofs.", tags: ["Beat Plan", "GPS", "Proofs", "Expenses"] },
  { suffix: "Fleet & Dispatch", desc: "Trip planning, fuel logs and driver performance.", tags: ["Trips", "Fuel", "Drivers", "Routes"] },
  { suffix: "IoT & Sensor Console", desc: "Device telemetry, thresholds and alerting.", tags: ["Telemetry", "Alerts", "Rules", "History"] },
  { suffix: "AI Copilot Add-on", desc: "Domain-trained assistant for staff and customers.", tags: ["Assistant", "Summaries", "Actions", "Voice"] },
  { suffix: "API & Integration Hub", desc: "REST/webhooks, connectors and sync monitoring.", tags: ["REST", "Webhooks", "Connectors", "Logs"] },
  { suffix: "Security & Access Control", desc: "SSO, MFA, granular permissions and session logs.", tags: ["SSO", "MFA", "RBAC", "Logs"] },
  { suffix: "Backup & Disaster Recovery", desc: "Scheduled backups, restore drills and retention rules.", tags: ["Backups", "Restore", "Retention", "Alerts"] },
  { suffix: "Multi-Branch Manager", desc: "Branch hierarchy, transfers and consolidated reporting.", tags: ["Branches", "Transfers", "Roll-up", "Limits"] },
];

const COLORS = [
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-indigo-600",
];

const shortName = (masterCategory: string) => masterCategory.replace(/\s*\(.*?\)\s*/g, "").split(/[&,]/)[0]!.trim();
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const expandCategoryRow = (masterCategory: string, base: Demo[], min = MIN_ROW_CARDS): Demo[] => {
  if (base.length >= min) return base;
  const label = shortName(masterCategory);
  const seedIcon = base[0]?.icon;
  const extras: Demo[] = [];
  for (let i = 0; extras.length + base.length < min; i++) {
    const mod = SUB_MODULES[i % SUB_MODULES.length]!;
    const round = Math.floor(i / SUB_MODULES.length);
    const name = round === 0 ? `${label} ${mod.suffix}` : `${label} ${mod.suffix} ${round + 1}`;
    const id = `${slug(masterCategory)}-${slug(mod.suffix)}-${round}`;
    if (base.some((demo) => demo.name === name)) continue;
    extras.push({
      id,
      name,
      category: mod.suffix,
      masterCategory,
      description: `${label}: ${mod.desc}`,
      url: base[0]?.url ?? "#",
      icon: base[i % base.length]?.icon ?? seedIcon,
      status: "COMING_SOON",
      features: mod.tags,
      frontend: ["React", "TypeScript", "Premium UI"],
      backend: ["Node.js", "PostgreSQL", "REST API"],
      color: COLORS[i % COLORS.length]!,
      price: LIFETIME_PRICE,
      discountPrice: LIFETIME_PRICE,
    });
  }
  return [...base, ...extras];
};
