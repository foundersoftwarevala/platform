import {
  Package, Download, DollarSign, TrendingUp, Star, Users,
  ShoppingCart, RotateCcw, Boxes, UserCheck, FileBadge, Target,
  MousePointerClick, Megaphone, Wallet, Trophy,
  Heart, Image as ImgIcon, Activity, Building2, UserPlus, BarChart3,
  Sparkles, Search, Link2, FileSearch, LineChart,
  Users2, ShoppingBag, Ticket, ShieldCheck,
  PieChart, FileText, Wrench, Brain, Repeat, AlertTriangle,
  ClipboardList, Truck, Layers, MapPin, Settings as SettingsIcon,
  Hourglass, PackageCheck, Award, LifeBuoy,
  Code2, Bug, Timer, GitBranch, ShieldAlert, FileSignature,
  ScrollText, ClipboardCheck, Gavel, Handshake, ListChecks,
  BadgeCheck, ClipboardX, CheckCircle2, Flame, MessageSquare,
  type LucideIcon,
} from "lucide-react";

const ACHV = { key: "achievements", label: "Achievements", icon: Award };
const AMS  = { key: "ams",          label: "AMS",          icon: LifeBuoy };
const AMSC = { key: "ams-center",   label: "AMS Center",   icon: Sparkles };


export type RoleKey =
  | "author" | "vendor" | "reseller" | "affiliate"
  | "influencer" | "franchise" | "seo" | "admin"
  | "developer" | "dev-manager" | "promise-tracker";

export type Kpi = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: "brand" | "success" | "warning" | "danger" | "violet" | "cyan";
  unit?: string; // "$" | "%" | "" - hint only
};

export type RoleBanner = {
  eyebrow: string;       // e.g. "Creator hub"
  headline: string;      // role-specific welcome
  sub: string;           // one-liner sub
  cta: string;           // primary action
  gradient: string;      // css gradient
  accent: string;        // accent color token
};

export type RoleConfig = {
  key: RoleKey;
  name: string;          // "Author"
  title: string;         // "Author Dashboard"
  tagline: string;
  benchmarks: string[];
  modules: { key: string; label: string; icon: LucideIcon }[];
  kpis: Kpi[];
  banner: RoleBanner;
};

// Banners — each role gets a unique gradient + copy. NOT generic.
const banners: Record<RoleKey, RoleBanner> = {
  author: {
    eyebrow: "Creator Hub",
    headline: "Build. Publish. Earn.",
    sub: "Your products, downloads & royalties — one creator workspace.",
    cta: "Upload Product",
    gradient: "linear-gradient(120deg, oklch(0.28 0.08 290) 0%, oklch(0.32 0.18 280) 55%, oklch(0.42 0.22 310) 100%)",
    accent: "oklch(0.75 0.2 300)",
  },
  vendor: {
    eyebrow: "Seller Central",
    headline: "Sell smarter, ship faster.",
    sub: "Orders, inventory & customers across every storefront.",
    cta: "Add Product",
    gradient: "linear-gradient(120deg, oklch(0.26 0.05 240) 0%, oklch(0.3 0.15 215) 55%, oklch(0.38 0.18 195) 100%)",
    accent: "oklch(0.78 0.16 210)",
  },
  reseller: {
    eyebrow: "Reseller Center",
    headline: "Your clients, your margin.",
    sub: "Manage licenses, renewals & commissions in one place.",
    cta: "New Client",
    gradient: "linear-gradient(120deg, oklch(0.26 0.06 175) 0%, oklch(0.3 0.14 165) 55%, oklch(0.38 0.18 155) 100%)",
    accent: "oklch(0.78 0.16 165)",
  },
  affiliate: {
    eyebrow: "Affiliate Hub",
    headline: "Track every click. Cash every conversion.",
    sub: "Links, campaigns, payouts & leaderboard rank.",
    cta: "Create Link",
    gradient: "linear-gradient(120deg, oklch(0.26 0.08 50) 0%, oklch(0.32 0.16 40) 55%, oklch(0.42 0.2 30) 100%)",
    accent: "oklch(0.8 0.16 55)",
  },
  influencer: {
    eyebrow: "Creator Studio",
    headline: "Brand deals, made beautiful.",
    sub: "Campaigns, content calendar & engagement insights.",
    cta: "New Campaign",
    gradient: "linear-gradient(120deg, oklch(0.28 0.1 350) 0%, oklch(0.32 0.18 340) 55%, oklch(0.42 0.22 20) 100%)",
    accent: "oklch(0.78 0.2 340)",
  },
  franchise: {
    eyebrow: "Franchise Network",
    headline: "Scale every branch.",
    sub: "Branch performance, leads pipeline & growth metrics.",
    cta: "Open Branch",
    gradient: "linear-gradient(120deg, oklch(0.24 0.04 260) 0%, oklch(0.3 0.12 250) 55%, oklch(0.38 0.16 240) 100%)",
    accent: "oklch(0.78 0.14 250)",
  },
  seo: {
    eyebrow: "SEO Workspace",
    headline: "Outrank. Out-traffic. Outperform.",
    sub: "Projects, keywords, backlinks & technical audits.",
    cta: "New Project",
    gradient: "linear-gradient(120deg, oklch(0.24 0.05 150) 0%, oklch(0.3 0.14 140) 55%, oklch(0.4 0.18 130) 100%)",
    accent: "oklch(0.8 0.18 140)",
  },
  admin: {
    eyebrow: "Platform Control",
    headline: "Run the whole house.",
    sub: "Users, orders, approvals, tickets & platform health.",
    cta: "Open Console",
    gradient: "linear-gradient(120deg, oklch(0.2 0.03 270) 0%, oklch(0.26 0.08 0) 55%, oklch(0.36 0.18 25) 100%)",
    accent: "oklch(0.78 0.2 25)",
  },
  developer: {
    eyebrow: "Developer Workspace",
    headline: "Ship code. Earn XP.",
    sub: "Tasks, bugs, code review, timers & performance — one command center.",
    cta: "Open Command Center",
    gradient: "linear-gradient(120deg, oklch(0.24 0.05 260) 0%, oklch(0.30 0.14 250) 55%, oklch(0.40 0.18 230) 100%)",
    accent: "oklch(0.78 0.16 250)",
  },
  "dev-manager": {
    eyebrow: "Developer Management",
    headline: "Orchestrate every sprint.",
    sub: "Registry, tasks, QA, incentives, compliance & security.",
    cta: "Assign Task",
    gradient: "linear-gradient(120deg, oklch(0.24 0.06 220) 0%, oklch(0.30 0.14 210) 55%, oklch(0.40 0.18 195) 100%)",
    accent: "oklch(0.80 0.16 200)",
  },
  "promise-tracker": {
    eyebrow: "Promise Center",
    headline: "Every promise, kept on time.",
    sub: "Track, categorize & enforce commitments across teams.",
    cta: "Create Promise",
    gradient: "linear-gradient(120deg, oklch(0.24 0.06 320) 0%, oklch(0.30 0.14 330) 55%, oklch(0.40 0.20 350) 100%)",
    accent: "oklch(0.80 0.18 340)",
  },
};

export const ROLES: Record<RoleKey, RoleConfig> = {
  author: {
    key: "author", name: "Author", title: "Author Dashboard",
    tagline: "Creator hub for digital products",
    benchmarks: ["Gumroad Creator", "Envato Author"],
    modules: [
      { key: "products", label: "Products", icon: Package },
      { key: "downloads", label: "Downloads", icon: Download },
      { key: "sales", label: "Sales", icon: ShoppingCart },
      { key: "revenue", label: "Revenue", icon: DollarSign },
      { key: "reviews", label: "Reviews", icon: Star },
      { key: "followers", label: "Followers", icon: Users },
      ACHV, AMS, AMSC,
    ],
    kpis: [
      { key:"products", label:"Products", icon:Package, tone:"brand" },
      { key:"downloads", label:"Downloads", icon:Download, tone:"cyan" },
      { key:"sales", label:"Sales", icon:ShoppingCart, tone:"success" },
      { key:"revenue", label:"Revenue", icon:DollarSign, tone:"success", unit:"$" },
      { key:"reviews", label:"Reviews", icon:Star, tone:"warning" },
      { key:"followers", label:"Followers", icon:Users, tone:"violet" },
    ],
    banner: banners.author,
  },
  vendor: {
    key: "vendor", name: "Vendor", title: "Vendor Dashboard",
    tagline: "Seller central for stores",
    benchmarks: ["Amazon Seller Central", "Shopify Partner"],
    modules: [
      { key:"products", label:"Products", icon:Package },
      { key:"orders", label:"Orders", icon:ShoppingCart },
      { key:"revenue", label:"Revenue", icon:DollarSign },
      { key:"customers", label:"Customers", icon:Users },
      { key:"returns", label:"Returns", icon:RotateCcw },
      { key:"inventory", label:"Inventory", icon:Boxes },
      { key:"analytics", label:"Analytics", icon:BarChart3 },
      { key:"marketing", label:"Marketing", icon:Megaphone },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      ACHV, AMS, AMSC,
    ],
    kpis: [
      { key:"products", label:"Active Products", icon:Package, tone:"brand" },
      { key:"products-draft", label:"Draft Products", icon:ClipboardList, tone:"warning" },
      { key:"inventory-oos", label:"Out Of Stock", icon:AlertTriangle, tone:"danger" },
      { key:"inventory", label:"Low Stock", icon:Boxes, tone:"warning" },
      { key:"orders", label:"Orders Today", icon:ShoppingCart, tone:"cyan" },
      { key:"orders-pending", label:"Pending Orders", icon:Hourglass, tone:"warning" },
      { key:"orders-completed", label:"Completed Orders", icon:PackageCheck, tone:"success" },
      { key:"orders-cancelled", label:"Cancelled Orders", icon:RotateCcw, tone:"danger" },
      { key:"revenue", label:"Revenue Today", icon:DollarSign, tone:"success", unit:"$" },
      { key:"revenue-month", label:"Revenue This Month", icon:TrendingUp, tone:"success", unit:"$" },
      { key:"customers", label:"Customers", icon:Users, tone:"violet" },
      { key:"customers-repeat", label:"Repeat Customers", icon:Repeat, tone:"violet" },
      { key:"returns", label:"Return Requests", icon:RotateCcw, tone:"warning" },
      { key:"refunds", label:"Refund Requests", icon:Wallet, tone:"danger" },
    ],
    banner: banners.vendor,
  },
  reseller: {
    key: "reseller", name: "Reseller", title: "Reseller Dashboard",
    tagline: "Manage clients and licenses",
    benchmarks: ["GoHighLevel Reseller", "WHMCS Reseller Center"],
    modules: [
      { key:"clients", label:"Clients", icon:UserCheck },
      { key:"licenses", label:"Licenses", icon:FileBadge },
      { key:"leads", label:"Leads", icon:Target },
      { key:"commissions", label:"Commissions", icon:Wallet },
      { key:"revenue", label:"Revenue", icon:DollarSign },
      { key:"renewals", label:"Renewals", icon:RotateCcw },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      ACHV, AMS, AMSC,
    ],
    kpis: [
      { key:"clients", label:"Active Clients", icon:UserCheck, tone:"brand" },
      { key:"licenses", label:"Active Licenses", icon:FileBadge, tone:"cyan" },
      { key:"trial-clients", label:"Trial Clients", icon:Hourglass, tone:"warning" },
      { key:"expired-licenses", label:"Expired Licenses", icon:AlertTriangle, tone:"danger" },
      { key:"leads", label:"Active Leads", icon:Target, tone:"violet" },
      { key:"leads-won", label:"Won Leads", icon:PackageCheck, tone:"success" },
      { key:"leads-lost", label:"Lost Leads", icon:AlertTriangle, tone:"danger" },
      { key:"leads-pending", label:"Pending Leads", icon:Hourglass, tone:"warning" },
      { key:"commissions", label:"Monthly Commission", icon:Wallet, tone:"success", unit:"$" },
      { key:"payout-pending", label:"Pending Payout", icon:Hourglass, tone:"warning", unit:"$" },
      { key:"revenue", label:"Total Revenue", icon:DollarSign, tone:"success", unit:"$" },
      { key:"renewals", label:"Renewal Rate", icon:RotateCcw, tone:"warning", unit:"%" },
    ],
    banner: banners.reseller,
  },
  affiliate: {
    key:"affiliate", name:"Affiliate", title:"Affiliate Dashboard",
    tagline:"Track clicks, conversions & payouts",
    benchmarks:["PartnerStack","Impact.com"],
    modules:[
      { key:"clicks", label:"Clicks", icon:MousePointerClick },
      { key:"conversions", label:"Conversions", icon:TrendingUp },
      { key:"commissions", label:"Commissions", icon:Wallet },
      { key:"campaigns", label:"Campaigns", icon:Megaphone },
      { key:"payouts", label:"Payouts", icon:DollarSign },
      { key:"rank", label:"Rank", icon:Trophy },
      { key:"marketing", label:"Marketing Kit", icon:ImgIcon },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"clicks", label:"Total Clicks", icon:MousePointerClick, tone:"cyan" },
      { key:"conversions", label:"Conversion Rate", icon:TrendingUp, tone:"success", unit:"%" },
      { key:"commissions", label:"Pending Commission", icon:Wallet, tone:"warning", unit:"$" },
      { key:"campaigns", label:"Active Campaigns", icon:Megaphone, tone:"brand" },
      { key:"payouts", label:"Pending Payouts", icon:DollarSign, tone:"warning", unit:"$" },
      { key:"rank", label:"Global Rank", icon:Trophy, tone:"violet" },
      { key:"marketing", label:"Banners", icon:ImgIcon, tone:"cyan" },
      { key:"ai", label:"AI Tasks", icon:Brain, tone:"violet" },
      { key:"reports", label:"Reports", icon:FileText, tone:"brand" },
    ],
    banner: banners.affiliate,
  },
  influencer: {
    key:"influencer", name:"Influencer", title:"Influencer Dashboard",
    tagline:"Brand deals & content performance",
    benchmarks:["CreatorIQ","Upfluence"],
    modules:[
      { key:"followers", label:"Followers", icon:Users },
      { key:"campaigns", label:"Campaigns", icon:Megaphone },
      { key:"brands", label:"Brands", icon:Heart },
      { key:"content", label:"Content", icon:ImgIcon },
      { key:"revenue", label:"Revenue", icon:DollarSign },
      { key:"engagement", label:"Engagement", icon:Activity },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"followers", label:"Followers", icon:Users, tone:"violet" },
      { key:"campaigns", label:"Campaigns", icon:Megaphone, tone:"brand" },
      { key:"brands", label:"Brands", icon:Heart, tone:"danger" },
      { key:"content", label:"Content", icon:ImgIcon, tone:"cyan" },
      { key:"revenue", label:"Revenue", icon:DollarSign, tone:"success", unit:"$" },
      { key:"engagement", label:"Engagement", icon:Activity, tone:"warning", unit:"%" },
    ],
    banner: banners.influencer,
  },
  franchise: {
    key:"franchise", name:"Franchise", title:"Franchise Dashboard",
    tagline:"Branches, leads & growth",
    benchmarks:["FranchiseSoft","HubSpot Partner Portal"],
    modules:[
      { key:"branches", label:"Branches", icon:Building2 },
      { key:"leads", label:"Leads", icon:Target },
      { key:"revenue", label:"Revenue", icon:DollarSign },
      { key:"employees", label:"Employees", icon:UserPlus },
      { key:"performance", label:"Performance", icon:BarChart3 },
      { key:"growth", label:"Growth", icon:TrendingUp },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"branches", label:"Active Branches", icon:Building2, tone:"brand" },
      { key:"leads", label:"Qualified Leads", icon:Target, tone:"violet" },
      { key:"revenue", label:"Net Revenue", icon:DollarSign, tone:"success", unit:"$" },
      { key:"employees", label:"Active Employees", icon:UserPlus, tone:"cyan" },
      { key:"performance", label:"Performance", icon:BarChart3, tone:"warning" },
      { key:"growth", label:"Growth Rate", icon:TrendingUp, tone:"success", unit:"%" },
      { key:"ai", label:"AI Tasks", icon:Brain, tone:"violet" },
      { key:"reports", label:"Reports", icon:FileText, tone:"brand" },
    ],
    banner: banners.franchise,
  },

  seo: {
    key:"seo", name:"SEO Expert", title:"SEO Dashboard",
    tagline:"Projects, keywords & rankings",
    benchmarks:["Ahrefs","SEMrush Projects"],
    modules:[
      { key:"projects", label:"Projects", icon:Sparkles },
      { key:"keywords", label:"Keywords", icon:Search },
      { key:"traffic", label:"Traffic", icon:LineChart },
      { key:"backlinks", label:"Backlinks", icon:Link2 },
      { key:"audits", label:"Audits", icon:FileSearch },
      { key:"rankings", label:"Rankings", icon:Trophy },
      { key:"tools", label:"SEO Tools", icon:Wrench },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"projects", label:"Active Projects", icon:Sparkles, tone:"brand" },
      { key:"keywords", label:"Tracked Keywords", icon:Search, tone:"cyan" },
      { key:"traffic", label:"Organic Traffic", icon:LineChart, tone:"success" },
      { key:"backlinks", label:"Backlinks", icon:Link2, tone:"violet" },
      { key:"audits", label:"Audits", icon:FileSearch, tone:"warning" },
      { key:"rankings", label:"Avg. Ranking", icon:Trophy, tone:"success" },
      { key:"tools", label:"SEO Tools", icon:Wrench, tone:"cyan" },
      { key:"ai", label:"AI Tasks", icon:Brain, tone:"violet" },
      { key:"reports", label:"Reports", icon:FileText, tone:"brand" },
    ],

    banner: banners.seo,
  },
  admin: {
    key:"admin", name:"Admin", title:"Admin Dashboard",
    tagline:"Platform overview & approvals",
    benchmarks:["Software Vala Core"],
    modules:[
      { key:"users", label:"Users", icon:Users2 },
      { key:"orders", label:"Orders", icon:ShoppingBag },
      { key:"revenue", label:"Revenue", icon:DollarSign },
      { key:"products", label:"Products", icon:Package },
      { key:"tickets", label:"Tickets", icon:Ticket },
      { key:"approvals", label:"Approvals", icon:ShieldCheck },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"users", label:"Users", icon:Users2, tone:"brand" },
      { key:"orders", label:"Orders", icon:ShoppingBag, tone:"cyan" },
      { key:"revenue", label:"Revenue", icon:DollarSign, tone:"success", unit:"$" },
      { key:"products", label:"Products", icon:Package, tone:"violet" },
      { key:"tickets", label:"Tickets", icon:Ticket, tone:"warning" },
      { key:"approvals", label:"Approvals", icon:ShieldCheck, tone:"danger" },
    ],
    banner: banners.admin,
  },
  developer: {
    key:"developer", name:"Developer", title:"Developer Dashboard",
    tagline:"Command center for shipping code",
    benchmarks:["Linear Dev", "GitHub Projects"],
    modules:[
      { key:"command-center", label:"Command Center", icon:Sparkles },
      { key:"tasks", label:"Tasks", icon:ClipboardList },
      { key:"bugs", label:"Bugs & Issues", icon:Bug },
      { key:"code-submission", label:"Code Submission", icon:Code2 },
      { key:"timer", label:"Timer & Productivity", icon:Timer },
      { key:"ai", label:"AI Assistant", icon:Brain },
      { key:"performance", label:"Performance", icon:BarChart3 },
      { key:"wallet", label:"Wallet & Payout", icon:Wallet },
      { key:"chat", label:"Team Chat", icon:MessageSquare },
      { key:"settings", label:"Settings", icon:SettingsIcon },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"tasks-open", label:"Open Tasks", icon:ClipboardList, tone:"brand" },
      { key:"tasks-done", label:"Tasks Completed", icon:CheckCircle2, tone:"success" },
      { key:"bugs-open", label:"Open Bugs", icon:Bug, tone:"danger" },
      { key:"commits", label:"Commits This Week", icon:GitBranch, tone:"cyan" },
      { key:"code-hours", label:"Coding Hours", icon:Timer, tone:"warning" },
      { key:"performance", label:"Performance Score", icon:BarChart3, tone:"violet", unit:"%" },
      { key:"payout", label:"Payout Pending", icon:Wallet, tone:"warning", unit:"$" },
      { key:"streak", label:"Ship Streak", icon:Flame, tone:"warning" },
    ],
    banner: banners.developer,
  },
  "dev-manager": {
    key:"dev-manager", name:"Dev Manager", title:"Developer Management Dashboard",
    tagline:"Registry, sprints, QA, incentives & compliance",
    benchmarks:["Jira Advanced Roadmaps","Azure DevOps"],
    modules:[
      { key:"overview", label:"Developer Dashboard", icon:BarChart3 },
      { key:"registry", label:"Developer Registry", icon:Users2 },
      { key:"onboarding", label:"Onboarding Requests", icon:UserPlus },
      { key:"roles", label:"Role & Skill Mapping", icon:Layers },
      { key:"tasks", label:"Task Management", icon:ClipboardList },
      { key:"sprint", label:"Sprint / Milestone", icon:Target },
      { key:"builds", label:"Build Assignment", icon:GitBranch },
      { key:"code-submission", label:"Code Submission", icon:Code2 },
      { key:"qa", label:"Review & QA", icon:ClipboardCheck },
      { key:"bugs", label:"Bug & Fix Tracker", icon:Bug },
      { key:"performance", label:"Performance & KPI", icon:BarChart3 },
      { key:"payments", label:"Payment & Incentive", icon:Wallet },
      { key:"compliance", label:"Compliance & NDA", icon:FileSignature },
      { key:"security", label:"Security & Access", icon:ShieldCheck },
      { key:"alerts", label:"Alerts & Escalation", icon:ShieldAlert },
      { key:"audit", label:"Audit Logs", icon:ScrollText },
      { key:"ai", label:"AI Suite", icon:Brain },
      { key:"reports", label:"Reports", icon:FileText },
      { key:"settings", label:"Settings", icon:SettingsIcon },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"developers", label:"Active Developers", icon:Users2, tone:"brand" },
      { key:"onboarding", label:"Onboarding Requests", icon:UserPlus, tone:"cyan" },
      { key:"tasks", label:"Tasks In-Flight", icon:ClipboardList, tone:"violet" },
      { key:"sprint", label:"Sprint Progress", icon:Target, tone:"warning", unit:"%" },
      { key:"qa-pending", label:"QA Pending", icon:ClipboardCheck, tone:"warning" },
      { key:"bugs", label:"Open Bugs", icon:Bug, tone:"danger" },
      { key:"performance", label:"Team Performance", icon:BarChart3, tone:"success", unit:"%" },
      { key:"payout", label:"Payouts This Month", icon:Wallet, tone:"success", unit:"$" },
      { key:"compliance", label:"Compliance", icon:FileSignature, tone:"cyan", unit:"%" },
      { key:"escalations", label:"Escalations", icon:ShieldAlert, tone:"danger" },
    ],
    banner: banners["dev-manager"],
  },
  "promise-tracker": {
    key:"promise-tracker", name:"Promise Tracker", title:"Promise Tracker Dashboard",
    tagline:"Track, enforce & fulfill every commitment",
    benchmarks:["ServiceNow SLA","Zendesk Guarantees"],
    modules:[
      { key:"overview", label:"Overview", icon:BarChart3 },
      { key:"all", label:"All Promises", icon:ListChecks },
      { key:"create", label:"Create Promise", icon:FileSignature },
      { key:"categories", label:"Promise Categories", icon:Layers },
      { key:"sales", label:"Sales", icon:ShoppingCart },
      { key:"support", label:"Support", icon:LifeBuoy },
      { key:"delivery", label:"Delivery", icon:Truck },
      { key:"payment", label:"Payment", icon:Wallet },
      { key:"legal", label:"Legal", icon:Gavel },
      { key:"partnership", label:"Partnership", icon:Handshake },
      { key:"sla", label:"SLA", icon:BadgeCheck },
      { key:"active", label:"Active Promises", icon:CheckCircle2 },
      { key:"delayed", label:"Delayed Promises", icon:Hourglass },
      { key:"broken", label:"Broken Promises", icon:ClipboardX },
      { key:"fulfilled", label:"Fulfilled Promises", icon:PackageCheck },
      { key:"escalations", label:"Escalations", icon:ShieldAlert },
      { key:"fine-tip", label:"Fine & Tip Rules", icon:AlertTriangle },
      { key:"ai", label:"AI Insights", icon:Brain },
      { key:"audit", label:"Audit Logs", icon:ScrollText },
      { key:"settings", label:"Settings", icon:SettingsIcon },
      ACHV, AMS, AMSC,
    ],
    kpis:[
      { key:"active", label:"Active Promises", icon:CheckCircle2, tone:"brand" },
      { key:"fulfilled", label:"Fulfilled", icon:PackageCheck, tone:"success" },
      { key:"delayed", label:"Delayed", icon:Hourglass, tone:"warning" },
      { key:"broken", label:"Broken", icon:ClipboardX, tone:"danger" },
      { key:"escalations", label:"Escalations", icon:ShieldAlert, tone:"danger" },
      { key:"sla", label:"SLA Compliance", icon:BadgeCheck, tone:"success", unit:"%" },
      { key:"fines", label:"Fines Collected", icon:AlertTriangle, tone:"warning", unit:"$" },
      { key:"tips", label:"Tips Awarded", icon:Wallet, tone:"cyan", unit:"$" },
    ],
    banner: banners["promise-tracker"],
  },
};

export const ROLE_ORDER: RoleKey[] = ["author","vendor","reseller","affiliate","influencer","franchise","seo","admin","developer","dev-manager","promise-tracker"];

export function isRoleKey(s: string | undefined | null): s is RoleKey {
  return !!s && (ROLE_ORDER as string[]).includes(s);
}
