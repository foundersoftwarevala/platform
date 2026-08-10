/**
 * Netflix-row filler: guarantees every master-category row on the marketplace
 * home page carries at least 40 related sub-category product cards.
 *
 * The pad items are real sub-category modules of the same master category
 * (billing, inventory, HR, analytics, mobile app, …) so each row stays
 * topically related instead of showing unrelated products.
 */
import type { LucideIcon } from "lucide-react";
import {
  Activity, BarChart3, Bell, Boxes, Briefcase, Calculator, Calendar, Camera,
  ClipboardCheck, Cloud, Cpu, CreditCard, Database, FileText, Fingerprint,
  Globe, Headphones, Layers, LineChart, Lock, Mail, MapPin, MessageSquare,
  MonitorPlay, Package, PieChart, QrCode, Receipt, Repeat, Settings, Share2,
  Shield, ShoppingCart, Smartphone, Star, Target, Truck, Users, Wallet, Workflow,
} from "lucide-react";

import { LIFETIME_MRP, LIFETIME_PRICE } from "@/lib/site-content/constants";

export type RowDemo = {
  id: string;
  name: string;
  category: string;
  masterCategory: string;
  description: string;
  url: string;
  icon: LucideIcon | unknown;
  status: "ACTIVE" | "COMING_SOON";
  features: string[];
  frontend: string[];
  backend: string[];
  color: string;
  price: string;
  discountPrice: string;
};

export const ROW_TARGET = 40;

type Module = { sub: string; product: string; icon: LucideIcon; features: string[] };

const MODULES: Module[] = [
  { sub: "Billing & Invoicing", product: "Billing Suite", icon: Receipt, features: ["Invoices", "Taxes", "Recurring", "PDF Export"] },
  { sub: "Payments & Wallet", product: "Payment Hub", icon: Wallet, features: ["Gateways", "Wallet", "Refunds", "Settlements"] },
  { sub: "Accounting", product: "Accounts Manager", icon: Calculator, features: ["Ledgers", "GST", "Balance Sheet", "Audit"] },
  { sub: "Inventory", product: "Inventory Control", icon: Boxes, features: ["Stock", "Batches", "Reorder", "Barcodes"] },
  { sub: "Procurement", product: "Purchase Manager", icon: Package, features: ["PO", "Vendors", "GRN", "Approvals"] },
  { sub: "Supply Chain", product: "Supply Chain OS", icon: Truck, features: ["Routing", "Tracking", "SLA", "Fleet"] },
  { sub: "CRM", product: "CRM Pro", icon: Users, features: ["Leads", "Pipeline", "Tasks", "Quotes"] },
  { sub: "Sales Automation", product: "Sales Engine", icon: Target, features: ["Deals", "Targets", "Commission", "Forecast"] },
  { sub: "Marketing", product: "Campaign Studio", icon: Share2, features: ["Campaigns", "Segments", "A/B", "Attribution"] },
  { sub: "Email & SMS", product: "Messaging Center", icon: Mail, features: ["Templates", "Bulk Send", "DLR", "Drip"] },
  { sub: "WhatsApp Suite", product: "WhatsApp Desk", icon: MessageSquare, features: ["Broadcast", "Chatbot", "Catalog", "Inbox"] },
  { sub: "HR & Payroll", product: "People Manager", icon: Briefcase, features: ["Payroll", "Leave", "Onboarding", "Payslips"] },
  { sub: "Attendance", product: "Attendance Tracker", icon: Fingerprint, features: ["Biometric", "Geo Punch", "Shifts", "Overtime"] },
  { sub: "Scheduling", product: "Scheduler Pro", icon: Calendar, features: ["Slots", "Reminders", "Rota", "Calendar Sync"] },
  { sub: "Task & Projects", product: "Project Board", icon: ClipboardCheck, features: ["Kanban", "Gantt", "Timesheets", "Files"] },
  { sub: "Workflow Automation", product: "Workflow Builder", icon: Workflow, features: ["Triggers", "Approvals", "Rules", "Webhooks"] },
  { sub: "Analytics", product: "Analytics Cloud", icon: BarChart3, features: ["Dashboards", "KPIs", "Cohorts", "Alerts"] },
  { sub: "Reporting", product: "Report Builder", icon: PieChart, features: ["Custom Reports", "Schedules", "Export", "Sharing"] },
  { sub: "Business Intelligence", product: "BI Workspace", icon: LineChart, features: ["Modelling", "Drilldown", "Forecast", "Embed"] },
  { sub: "Customer Portal", product: "Client Portal", icon: Globe, features: ["Self Service", "Docs", "Tickets", "Payments"] },
  { sub: "Helpdesk", product: "Support Desk", icon: Headphones, features: ["Tickets", "SLA", "Knowledge Base", "CSAT"] },
  { sub: "Notifications", product: "Notification Engine", icon: Bell, features: ["Push", "In-App", "Email", "Rules"] },
  { sub: "Mobile App", product: "Mobile Companion", icon: Smartphone, features: ["Android", "iOS", "Offline", "Push"] },
  { sub: "POS", product: "POS Terminal", icon: ShoppingCart, features: ["Offline Bill", "Split Pay", "Printers", "Shifts"] },
  { sub: "QR & Barcode", product: "QR Toolkit", icon: QrCode, features: ["QR Gen", "Scan", "Labels", "Audit"] },
  { sub: "Document Manager", product: "Docs Vault", icon: FileText, features: ["Versions", "E-Sign", "Sharing", "Retention"] },
  { sub: "Compliance", product: "Compliance Tracker", icon: Shield, features: ["Policies", "Checklists", "Evidence", "Audit Log"] },
  { sub: "Access Control", product: "Access Manager", icon: Lock, features: ["Roles", "SSO", "2FA", "Sessions"] },
  { sub: "Data & Backup", product: "Data Guard", icon: Database, features: ["Backups", "Restore", "Archive", "Export"] },
  { sub: "Cloud & Hosting", product: "Cloud Console", icon: Cloud, features: ["Deploy", "Scaling", "Domains", "SSL"] },
  { sub: "AI Assistant", product: "AI Copilot", icon: Cpu, features: ["Ask Data", "Summaries", "Drafting", "Insights"] },
  { sub: "Loyalty", product: "Loyalty Engine", icon: Star, features: ["Points", "Tiers", "Coupons", "Referrals"] },
  { sub: "Subscriptions", product: "Subscription Manager", icon: Repeat, features: ["Plans", "Dunning", "Upgrades", "Invoices"] },
  { sub: "Field Operations", product: "Field Force App", icon: MapPin, features: ["Beat Plan", "Check-in", "Orders", "Expenses"] },
  { sub: "Asset Management", product: "Asset Registry", icon: Layers, features: ["Tagging", "AMC", "Depreciation", "Service"] },
  { sub: "Media & Gallery", product: "Media Manager", icon: Camera, features: ["Uploads", "CDN", "Albums", "Watermark"] },
  { sub: "Live Monitoring", product: "Live Ops Monitor", icon: Activity, features: ["Health", "Uptime", "Logs", "Alerts"] },
  { sub: "Training & LMS", product: "Training Academy", icon: MonitorPlay, features: ["Courses", "Quizzes", "Certificates", "Tracking"] },
  { sub: "Payment Links", product: "Payment Links", icon: CreditCard, features: ["Links", "QR Pay", "Reminders", "Reconcile"] },
  { sub: "Settings & White Label", product: "White Label Studio", icon: Settings, features: ["Branding", "Domains", "Themes", "Multi-tenant"] },
];

const COLORS = [
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-indigo-600",
  "from-fuchsia-500 to-violet-700",
  "from-lime-500 to-emerald-700",
];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Returns the row items for one master category: the real products first,
 * then related sub-category modules until the row reaches `target` cards.
 */
export function buildRow<T extends RowDemo>(masterCategory: string, real: T[], target = ROW_TARGET): RowDemo[] {
  const rows: RowDemo[] = [...real];
  const base = slug(masterCategory);
  let i = 0;
  while (rows.length < target) {
    const m = MODULES[i % MODULES.length]!;
    const pass = Math.floor(i / MODULES.length);
    const name = `${masterCategory} ${m.product}${pass > 0 ? ` ${pass + 1}` : ""}`;
    rows.push({
      id: `${base}-fill-${i}`,
      name,
      category: m.sub,
      masterCategory,
      description: `${m.sub} module built for ${masterCategory.toLowerCase()} teams — ${m.features
        .slice(0, 3)
        .join(", ")
        .toLowerCase()} with full source code and white-label branding.`,
      url: "#",
      icon: m.icon,
      status: "COMING_SOON",
      features: m.features,
      frontend: ["React", "TypeScript", "Premium UI"],
      backend: ["Node.js", "PostgreSQL", "REST API"],
      color: COLORS[i % COLORS.length]!,
      price: LIFETIME_MRP,
      discountPrice: LIFETIME_PRICE,
    });
    i++;
  }
  return rows;
}