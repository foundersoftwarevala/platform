import {
  Scissors, Dumbbell, HeartHandshake, UserPlus, Camera, Briefcase,
  Printer, Shirt, Cpu, Cloud, Coins, Gamepad2, Mic, Sun, Recycle,
  Building, Star, Users, Package, Wallet, Wrench, Bot, Zap, Globe,
  Server, Shield, Trophy, MonitorPlay, Leaf, Trash2,
} from "lucide-react";

export interface Demo {
  id: string;
  name: string;
  category: string;
  masterCategory: string;
  description: string;
  url: string;
  icon: any;
  status: "ACTIVE" | "COMING_SOON";
  features: string[];
  frontend: string[];
  backend: string[];
  color: string;
  price: string;
  discountPrice: string;
}

const mk = (
  id: string, name: string, cat: string, mc: string, desc: string,
  icon: any, color: string, features: string[], price: string, disc: string
): Demo => ({
  id, name, category: cat, masterCategory: mc, description: desc,
  url: "#", icon, status: "COMING_SOON",
  features,
  frontend: ["React", "TypeScript", "Premium UI"],
  backend: ["Node.js", "PostgreSQL", "REST API"],
  color, price, discountPrice: disc,
});

export const extraDemos: Demo[] = [
  // 1. Beauty & Wellness
  mk("bw-1", "Salon Chain OS", "Salon Chain", "Beauty & Wellness", "Multi-branch salon management with appointments, stylist commissions & loyalty.", Scissors, "from-pink-500 to-rose-600", ["Appointments", "Commissions", "Loyalty", "Multi-branch"], "₹64,999", "₹38,999"),
  mk("bw-2", "Spa & Wellness Suite", "Spa", "Beauty & Wellness", "Spa bookings, therapist rota, package plans and gift cards.", Star, "from-rose-500 to-fuchsia-600", ["Bookings", "Rota", "Packages", "Gift Cards"], "₹54,999", "₹32,999"),
  mk("bw-3", "Beauty Studio POS", "Beauty POS", "Beauty & Wellness", "POS + inventory + client history for beauty studios.", Wallet, "from-fuchsia-500 to-pink-600", ["POS", "Client CRM", "Inventory", "Reports"], "₹39,999", "₹23,999"),

  // 2. Fitness & Sports
  mk("fs-1", "Gym Chain Manager", "Gym Chain", "Fitness & Sports", "Multi-gym membership, class booking, trainer & diet plans.", Dumbbell, "from-orange-500 to-red-600", ["Memberships", "Classes", "Trainers", "Diet"], "₹69,999", "₹41,999"),
  mk("fs-2", "Sports Academy Platform", "Sports Academy", "Fitness & Sports", "Coach scheduling, athlete tracking, tournaments & payments.", Trophy, "from-amber-500 to-orange-600", ["Coaches", "Athletes", "Tournaments", "Payments"], "₹79,999", "₹47,999"),
  mk("fs-3", "Yoga Studio Suite", "Yoga Studio", "Fitness & Sports", "Classes, batches, online streaming and community.", Users, "from-teal-500 to-cyan-600", ["Batches", "Streaming", "Community", "Store"], "₹44,999", "₹26,999"),

  // 3. Non-Profit / NGO
  mk("ng-1", "NGO Donor CRM", "Donor CRM", "Non-Profit & NGO", "Donor pipelines, receipts, 80G tax certificates and campaigns.", HeartHandshake, "from-emerald-500 to-teal-600", ["Donor Pipeline", "80G", "Campaigns", "Receipts"], "₹49,999", "₹29,999"),
  mk("ng-2", "Volunteer Management", "Volunteers", "Non-Profit & NGO", "Volunteer onboarding, shifts, hours tracking and impact reports.", Users, "from-green-500 to-emerald-600", ["Onboarding", "Shifts", "Hours", "Impact"], "₹39,999", "₹23,999"),
  mk("ng-3", "Grant & Fund Tracker", "Grants", "Non-Profit & NGO", "Grant applications, disbursement, milestones and audit reports.", Coins, "from-lime-500 to-green-600", ["Grants", "Disburse", "Milestones", "Audit"], "₹54,999", "₹32,999"),

  // 4. Franchise Management
  mk("fr-1", "Franchise Master ERP", "Franchise ERP", "Franchise Management", "HQ + franchisee onboarding, royalties, inventory & compliance.", Building, "from-indigo-500 to-purple-600", ["Onboarding", "Royalties", "Compliance", "Reports"], "₹99,999", "₹59,999"),
  mk("fr-2", "Territory & Lead Router", "Territory", "Franchise Management", "Territory rights, lead routing & performance scorecards.", Globe, "from-violet-500 to-indigo-600", ["Territory", "Leads", "Scorecards", "Alerts"], "₹64,999", "₹38,999"),
  mk("fr-3", "Franchise Payout Engine", "Payouts", "Franchise Management", "Automated royalty, incentive and settlement workflows.", Wallet, "from-purple-500 to-fuchsia-600", ["Royalty", "Incentives", "Settlement", "GST"], "₹74,999", "₹44,999"),

  // 5. Recruitment & Staffing
  mk("rc-1", "AI ATS Suite", "ATS", "Recruitment & Staffing", "AI-powered applicant tracking with resume parsing & scoring.", UserPlus, "from-blue-500 to-cyan-600", ["Parsing", "Scoring", "Pipelines", "Offers"], "₹59,999", "₹35,999"),
  mk("rc-2", "Staffing Agency Platform", "Staffing", "Recruitment & Staffing", "Client, candidate, timesheet & invoice workflows for staffing.", Briefcase, "from-cyan-500 to-blue-600", ["Clients", "Timesheets", "Invoicing", "Payroll"], "₹79,999", "₹47,999"),
  mk("rc-3", "Interview Scheduler AI", "Interviews", "Recruitment & Staffing", "Multi-panel interview scheduling with feedback rubrics.", Bot, "from-sky-500 to-indigo-600", ["Scheduling", "Panels", "Feedback", "Analytics"], "₹34,999", "₹20,999"),

  // 6. Photography & Studio
  mk("ph-1", "Photo Studio Manager", "Photo Studio", "Photography & Studio", "Bookings, shoots, editors and delivery gallery.", Camera, "from-slate-500 to-gray-700", ["Bookings", "Shoots", "Editors", "Galleries"], "₹49,999", "₹29,999"),
  mk("ph-2", "Wedding Album Workflow", "Wedding Album", "Photography & Studio", "Album design tracking, client approvals and reprints.", Star, "from-rose-500 to-pink-600", ["Design", "Approvals", "Reprints", "Delivery"], "₹44,999", "₹26,999"),
  mk("ph-3", "Stock Photo Marketplace", "Stock Photo", "Photography & Studio", "Sell stock photos with licensing, watermark & payouts.", Globe, "from-zinc-500 to-slate-700", ["Licensing", "Watermark", "Payouts", "Search"], "₹64,999", "₹38,999"),

  // 7. Consulting & Advisory
  mk("cs-1", "Consulting Firm OS", "Consulting", "Consulting & Advisory", "Practice, project, timesheet & retainer management for consultancies.", Briefcase, "from-indigo-600 to-blue-700", ["Projects", "Timesheets", "Retainers", "Billing"], "₹89,999", "₹53,999"),
  mk("cs-2", "Strategy Deliverable Hub", "Deliverables", "Consulting & Advisory", "Version-controlled deliverables & client review portals.", Star, "from-blue-600 to-indigo-700", ["Versioning", "Reviews", "Approvals", "Portal"], "₹54,999", "₹32,999"),
  mk("cs-3", "Advisory KPI Tracker", "KPI", "Consulting & Advisory", "Client KPI dashboards with quarterly board packs.", Zap, "from-cyan-600 to-teal-700", ["KPIs", "Dashboards", "Board Pack", "Alerts"], "₹49,999", "₹29,999"),

  // 8. Publishing & Print
  mk("pb-1", "Print Shop ERP", "Print Shop", "Publishing & Print", "Job cards, prepress, presses, delivery & billing.", Printer, "from-stone-500 to-neutral-700", ["Job Cards", "Prepress", "Presses", "Billing"], "₹59,999", "₹35,999"),
  mk("pb-2", "Magazine Publisher Suite", "Magazine", "Publishing & Print", "Issues, subscriptions, ads and digital editions.", MonitorPlay, "from-neutral-500 to-stone-700", ["Issues", "Subscriptions", "Ads", "Digital"], "₹69,999", "₹41,999"),
  mk("pb-3", "Book Publisher Platform", "Book Publisher", "Publishing & Print", "Manuscript pipeline, royalties, ISBN & distribution.", Package, "from-gray-500 to-slate-700", ["Manuscripts", "Royalties", "ISBN", "Distribution"], "₹74,999", "₹44,999"),

  // 9. Fashion & Apparel
  mk("fa-1", "Fashion Retail POS", "Fashion POS", "Fashion & Apparel", "Size/color variants, seasonal collections and returns.", Shirt, "from-pink-600 to-fuchsia-700", ["Variants", "Seasons", "Returns", "Loyalty"], "₹49,999", "₹29,999"),
  mk("fa-2", "Boutique Manager", "Boutique", "Fashion & Apparel", "Custom tailoring orders, fittings and delivery tracking.", Star, "from-rose-600 to-pink-700", ["Orders", "Fittings", "Delivery", "Payments"], "₹39,999", "₹23,999"),
  mk("fa-3", "Apparel Manufacturing", "Apparel Mfg", "Fashion & Apparel", "BOM, cutting, stitching, QC and warehouse.", Package, "from-fuchsia-600 to-purple-700", ["BOM", "Cutting", "Stitching", "QC"], "₹99,999", "₹59,999"),

  // 10. IoT & Smart Devices
  mk("io-1", "IoT Device Manager", "IoT Devices", "IoT & Smart Devices", "Provisioning, OTA updates, telemetry and alerts.", Cpu, "from-cyan-600 to-blue-700", ["Provisioning", "OTA", "Telemetry", "Alerts"], "₹1,29,999", "₹77,999"),
  mk("io-2", "Smart Home Control", "Smart Home", "IoT & Smart Devices", "Rooms, scenes, automations and voice assistants.", Zap, "from-teal-600 to-cyan-700", ["Scenes", "Automations", "Voice", "Energy"], "₹69,999", "₹41,999"),
  mk("io-3", "Industrial Sensor Cloud", "Sensor Cloud", "IoT & Smart Devices", "Fleet sensors, edge rules and predictive maintenance.", Server, "from-slate-600 to-cyan-700", ["Fleet", "Edge", "Predictive", "Alerts"], "₹1,49,999", "₹89,999"),

  // 11. Cloud & DevOps
  mk("cd-1", "DevOps Console", "DevOps", "Cloud & DevOps", "CI/CD, environments, incidents and runbooks in one console.", Cloud, "from-sky-500 to-blue-700", ["CI/CD", "Envs", "Incidents", "Runbooks"], "₹1,19,999", "₹71,999"),
  mk("cd-2", "Cloud Cost Optimizer", "FinOps", "Cloud & DevOps", "Multi-cloud cost, savings recommendations and budgets.", Coins, "from-blue-500 to-indigo-700", ["Costs", "Savings", "Budgets", "Alerts"], "₹89,999", "₹53,999"),
  mk("cd-3", "Kubernetes Ops UI", "K8s Ops", "Cloud & DevOps", "Clusters, workloads, logs, metrics and policies.", Server, "from-indigo-500 to-purple-700", ["Clusters", "Logs", "Metrics", "Policies"], "₹1,09,999", "₹65,999"),

  // 12. Blockchain & Web3
  mk("bc-1", "NFT Marketplace Kit", "NFT", "Blockchain & Web3", "Mint, list, auction and royalty splits on multi-chain.", Coins, "from-purple-600 to-fuchsia-700", ["Mint", "Auction", "Royalty", "Multi-chain"], "₹1,49,999", "₹89,999"),
  mk("bc-2", "DeFi Dashboard", "DeFi", "Blockchain & Web3", "Wallets, positions, yields and risk in one screen.", Wallet, "from-violet-600 to-indigo-700", ["Wallets", "Yields", "Risk", "Alerts"], "₹99,999", "₹59,999"),
  mk("bc-3", "DAO Governance", "DAO", "Blockchain & Web3", "Proposals, voting, treasury and delegates.", Shield, "from-fuchsia-600 to-purple-700", ["Proposals", "Voting", "Treasury", "Delegates"], "₹89,999", "₹53,999"),

  // 13. Gaming & E-Sports
  mk("gm-1", "E-Sports Tournament Hub", "E-Sports", "Gaming & E-Sports", "Brackets, teams, prize pools, streams and stats.", Gamepad2, "from-red-600 to-rose-700", ["Brackets", "Teams", "Prizes", "Stats"], "₹79,999", "₹47,999"),
  mk("gm-2", "Game Studio Ops", "Game Studio", "Gaming & E-Sports", "Sprint boards, playtests, telemetry and live-ops.", Zap, "from-rose-600 to-pink-700", ["Sprints", "Playtests", "Telemetry", "Live-ops"], "₹1,19,999", "₹71,999"),
  mk("gm-3", "Gaming Cafe POS", "Cafe POS", "Gaming & E-Sports", "Rigs, sessions, food orders and memberships.", Gamepad2, "from-pink-600 to-purple-700", ["Rigs", "Sessions", "Food", "Members"], "₹49,999", "₹29,999"),

  // 14. Podcast & Streaming Media
  mk("pd-1", "Podcast Studio", "Podcast", "Podcast & Streaming Media", "Episodes, guests, edits, publishing and analytics.", Mic, "from-amber-600 to-orange-700", ["Episodes", "Guests", "Publish", "Analytics"], "₹59,999", "₹35,999"),
  mk("pd-2", "OTT Streaming Platform", "OTT", "Podcast & Streaming Media", "VOD/live, DRM, subscriptions and recommendations.", MonitorPlay, "from-orange-600 to-red-700", ["VOD", "Live", "DRM", "Subs"], "₹1,79,999", "₹1,07,999"),
  mk("pd-3", "Creator Monetization", "Creator", "Podcast & Streaming Media", "Memberships, tips, sponsorships and reports.", Wallet, "from-yellow-600 to-amber-700", ["Members", "Tips", "Sponsors", "Reports"], "₹49,999", "₹29,999"),

  // 15. Solar & Green Energy
  mk("sg-1", "Solar Installer CRM", "Solar CRM", "Solar & Green Energy", "Leads, site surveys, design, install and O&M.", Sun, "from-yellow-500 to-orange-600", ["Leads", "Surveys", "Design", "O&M"], "₹89,999", "₹53,999"),
  mk("sg-2", "Green Energy Trading", "Energy Trade", "Solar & Green Energy", "PPA, REC trading, forecasting and settlement.", Leaf, "from-green-500 to-emerald-700", ["PPA", "RECs", "Forecast", "Settlement"], "₹1,49,999", "₹89,999"),
  mk("sg-3", "EV Charging Ops", "EV Charging", "Solar & Green Energy", "Stations, sessions, tariffs and roaming.", Zap, "from-emerald-500 to-teal-700", ["Stations", "Sessions", "Tariffs", "Roaming"], "₹99,999", "₹59,999"),

  // 16. Waste & Recycling
  mk("wr-1", "Waste Collection Ops", "Collection", "Waste & Recycling", "Route planning, weigh-ins, driver app and billing.", Trash2, "from-lime-600 to-green-700", ["Routes", "Weigh-ins", "Driver App", "Billing"], "₹74,999", "₹44,999"),
  mk("wr-2", "Recycling Plant ERP", "Recycling", "Waste & Recycling", "Intake, sort, output batches, sales and compliance.", Recycle, "from-green-600 to-teal-700", ["Intake", "Sorting", "Batches", "Compliance"], "₹99,999", "₹59,999"),
  mk("wr-3", "e-Waste Tracker", "e-Waste", "Waste & Recycling", "Item lifecycle, certificates and audit trail.", Shield, "from-teal-600 to-emerald-700", ["Lifecycle", "Certificates", "Audit", "Reports"], "₹64,999", "₹38,999"),
];

// 55 unique master categories that will render as rows (each has products).
export const allMasterCategories55 = [
  // Existing 41 (as they appear in current data)
  "Education",
  "Retail & POS",
  "Healthcare",
  "Logistics",
  "Real Estate",
  "Finance",
  "Accounting",
  "Sales & CRM",
  "Marketing",
  "HR & Payroll",
  "ERP",
  "Enterprise Resource Planning (ERP)",
  "Inventory, Warehouse & Supply Chain",
  "E-commerce & Online Marketplaces",
  "Hospitality (Hotel, Restaurant, Travel)",
  "Telecom, Call Center & VoIP",
  "Customer Support & Helpdesk",
  "Legal, Compliance & Documentation",
  "Government & e-Governance Systems",
  "Security, Surveillance & Access Control",
  "Cyber Security & Data Protection",
  "Insurance",
  "Telecom",
  "Warehouse",
  "Rental",
  "Automobile",
  "Religious",
  "Public Utilities",
  "Defense",
  "Enterprise Admin",
  "Veterinary",
  "Food Manufacturing",
  "Media & Design",
  "Travel",
  "Academy",
  "Productivity",
  "AI & Automation",
  "Event",
  "Construction",
  "Agriculture",
  "Manufacturing",
  // 14 new master categories from extraDemos above
  "Beauty & Wellness",
  "Fitness & Sports",
  "Non-Profit & NGO",
  "Franchise Management",
  "Recruitment & Staffing",
  "Photography & Studio",
  "Consulting & Advisory",
  "Publishing & Print",
  "Fashion & Apparel",
  "IoT & Smart Devices",
  "Cloud & DevOps",
  "Blockchain & Web3",
  "Gaming & E-Sports",
  "Podcast & Streaming Media",
  "Solar & Green Energy",
  "Waste & Recycling",
];
// Note: array length is 57 (41 existing + 16 new); homepage filter drops any with 0 products.
// Wrench import kept above to avoid TS unused-import churn when tree-shaking.
void Wrench;
