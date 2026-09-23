import {
  Scissors, Dumbbell, HeartHandshake, UserPlus, Camera, Briefcase,
  Printer, Shirt, Cpu, Cloud, Coins, Gamepad2, Mic, Sun, Recycle,
  Building, Star, Users, Package, Wallet, Wrench, Bot, Zap, Globe,
  Server, Shield, Trophy, MonitorPlay, Leaf, Trash2,
  // The education titles below carry their own icons, so a row of eighty
  // reads as eighty different things rather than one icon repeated.
  School, Building2, GraduationCap, BookOpen, Layers, Database,
  ClipboardList, FileText, Laptop, Target, Award, UserCheck, Calendar,
  PenTool, Presentation, CreditCard, Home, Library, Bus, MapPin,
  TrendingUp, BarChart3, Video, Code, FlaskConical, Languages, Music,
  Palette, Baby, Clock, Puzzle, Bell, MessageSquare, Microscope,
  BadgeCheck, ShieldCheck, Sparkles, Store,
  // And the real estate titles below, for the same reason.
  Banknote, Box, Calculator, Compass, Gavel, Hammer, Handshake, Key,
  Landmark, LayoutGrid, Lock, Map, Monitor, Network, Percent, PieChart,
  Receipt, Ruler, Scale, ScanLine, Search, Share2, Tag,
  // And the healthcare titles below.
  Hospital, Stethoscope, BriefcaseMedical, CalendarClock, Pill, TestTube,
  Scan, Smile, Bone, PawPrint, Droplet, Ambulance, Siren, HeartPulse,
  Syringe, Thermometer, Activity, Bed,
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
  /**
   * What the entry says about its technology when no stack may be claimed.
   * A generic software category is not one product, so the honest answer is
   * that the stack has to be read off the actual implementation. Where this
   * is set it stands in place of the frontend/backend chips.
   */
  technologyNote?: string;
  /** Who the software is for, as the catalogue copy states it. */
  businessType?: string;
  /** The category of software this is, in the catalogue's own words. */
  softwareType?: string;
  /** The parts of the workflow the copy calls out beyond the feature list. */
  relatedDetails?: string;
  /** The notice that this describes a category, not a commercial product. */
  disclaimer?: string;
}

type DemoCopy = Pick<
  Demo,
  "technologyNote" | "businessType" | "softwareType" | "relatedDetails" | "disclaimer"
>;

const mk = (
  id: string, name: string, cat: string, mc: string, desc: string,
  icon: any, color: string, features: string[], price: string, disc: string,
  copy?: DemoCopy
): Demo => ({
  id, name, category: cat, masterCategory: mc, description: desc,
  url: "#", icon, status: "COMING_SOON",
  features,
  frontend: ["React", "TypeScript", "Premium UI"],
  backend: ["Node.js", "PostgreSQL", "REST API"],
  color, price, discountPrice: disc,
  ...copy,
});

/** The notice every generic-category entry carries. */
const CATEGORY_DISCLAIMER =
  "This is a generic software category/use case. Features and technology may vary by implementation and should not be treated as claims about a specific commercial product.";

/** What a generic-category entry says instead of naming a stack. */
const TECHNOLOGY_UNVERIFIED =
  "Product-dependent; exact technology stack must be verified from the actual implementation.";

/** A generic-category entry: no stack is claimed, and the notice is attached. */
const category = (
  businessType: string, softwareType: string, relatedDetails: string,
  disclaimer = CATEGORY_DISCLAIMER
): DemoCopy => ({
  technologyNote: TECHNOLOGY_UNVERIFIED,
  businessType, softwareType, relatedDetails, disclaimer,
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

  // 17. Education — the eighty titles the owner listed, in that order.
  // Seed entries: each stands in its place until an author publishes the real
  // product against it. The features are the modules that title implies, so a
  // row reads as a catalogue rather than as repetition.
  mk("edu-1", "School Management System", "School Management", "Education", "Admissions, sections, staff, attendance and parent communication in one school office.", School, "from-blue-600 to-indigo-600", ["Student Records", "Attendance", "Timetable", "Parent Portal"], "₹59,999", "₹35,999"),
  mk("edu-2", "College Management System", "College Management", "Education", "Departments, semesters, faculty loads and internal marks for a single college.", Building2, "from-indigo-600 to-violet-600", ["Departments", "Semesters", "Faculty Load", "Internal Marks"], "₹69,999", "₹41,999"),
  mk("edu-3", "University Management System", "University Management", "Education", "Multi-college university with affiliations, statutes and central examinations.", GraduationCap, "from-violet-600 to-purple-700", ["Affiliations", "Central Exams", "Statutes", "Convocation"], "₹99,999", "₹59,999"),
  mk("edu-4", "Student Information System (SIS)", "Student Information", "Education", "One student record from enquiry to alumni, shared by every department.", Users, "from-sky-500 to-blue-600", ["Unified Record", "Enrolment History", "Documents", "Transfers"], "₹64,999", "₹38,999"),
  mk("edu-5", "Learning Management System (LMS)", "Learning Management", "Education", "Courses, lessons, assignments and grading for blended teaching.", BookOpen, "from-cyan-500 to-blue-600", ["Course Builder", "Assignments", "Gradebook", "Discussions"], "₹74,999", "₹44,999"),
  mk("edu-6", "School ERP", "School ERP", "Education", "Academics, fees, payroll, stores and transport on one school ledger.", Layers, "from-blue-700 to-indigo-700", ["Academics", "Fees", "Payroll", "Inventory"], "₹84,999", "₹50,999"),
  mk("edu-7", "College ERP", "College ERP", "Education", "Admissions, academics, accounts and hostel for a degree college.", Layers, "from-indigo-700 to-blue-800", ["Admissions", "Accounts", "Hostel", "Examinations"], "₹89,999", "₹53,999"),
  mk("edu-8", "University ERP", "University ERP", "Education", "Campus-wide finance, HR, research and academic administration.", Database, "from-purple-700 to-indigo-800", ["Finance", "HR", "Research", "Affiliated Colleges"], "₹1,19,999", "₹71,999"),
  mk("edu-9", "Student Admission Management System", "Admissions", "Education", "Enquiry to enrolment with forms, merit lists, seats and offer letters.", ClipboardList, "from-emerald-500 to-teal-600", ["Online Forms", "Merit List", "Seat Matrix", "Offer Letters"], "₹54,999", "₹32,999"),
  mk("edu-10", "Examination Management System", "Examinations", "Education", "Exam calendar, hall tickets, seating, invigilation and marks entry.", FileText, "from-rose-500 to-red-600", ["Hall Tickets", "Seating Plan", "Invigilation", "Marks Entry"], "₹64,999", "₹38,999"),
  mk("edu-11", "Online Exam System", "Online Exams", "Education", "Timed online papers with question banks, shuffling and auto-submit.", Laptop, "from-red-500 to-orange-600", ["Question Bank", "Timers", "Shuffling", "Auto Submit"], "₹59,999", "₹35,999"),
  mk("edu-12", "Assessment Management System", "Assessment", "Education", "Rubrics, continuous assessment and outcome mapping across a programme.", Target, "from-orange-500 to-amber-600", ["Rubrics", "Continuous Assessment", "Outcome Mapping", "Moderation"], "₹57,999", "₹34,999"),
  mk("edu-13", "Result Management System", "Results", "Education", "Marks consolidation, grading schemes, revaluation and mark sheets.", Award, "from-amber-500 to-yellow-600", ["Grading Schemes", "Consolidation", "Revaluation", "Mark Sheets"], "₹52,999", "₹31,999"),
  mk("edu-14", "Attendance Management System", "Attendance", "Education", "Period-wise attendance with biometric or RFID capture and shortage alerts.", UserCheck, "from-green-500 to-emerald-600", ["Period-wise", "Biometric/RFID", "Shortage Alerts", "Reports"], "₹44,999", "₹26,999"),
  mk("edu-15", "Timetable Management System", "Timetable", "Education", "Clash-free timetables from teacher, room and subject constraints.", Calendar, "from-teal-500 to-cyan-600", ["Auto Generation", "Clash Detection", "Substitutions", "Room Allocation"], "₹49,999", "₹29,999"),
  mk("edu-16", "Course Management System", "Courses", "Education", "Course catalogue, prerequisites, credits and section planning.", BookOpen, "from-blue-500 to-cyan-600", ["Catalogue", "Prerequisites", "Credits", "Sections"], "₹54,999", "₹32,999"),
  mk("edu-17", "Curriculum Management System", "Curriculum", "Education", "Syllabus versions, learning outcomes and accreditation mapping.", PenTool, "from-indigo-500 to-blue-600", ["Syllabus Versions", "Learning Outcomes", "Mapping", "Approvals"], "₹58,999", "₹35,999"),
  mk("edu-18", "Faculty Management System", "Faculty", "Education", "Faculty profiles, workload, leave and appraisal in one place.", Briefcase, "from-slate-500 to-slate-700", ["Profiles", "Workload", "Leave", "Appraisal"], "₹56,999", "₹33,999"),
  mk("edu-19", "Teacher Management System", "Teachers", "Education", "Teacher allocation, substitutions, lesson plans and performance notes.", Presentation, "from-cyan-600 to-teal-700", ["Allocation", "Substitutions", "Lesson Plans", "Performance"], "₹52,999", "₹31,999"),
  mk("edu-20", "Parent Portal System", "Parent Portal", "Education", "Attendance, marks, fees and circulars for parents on web and phone.", HeartHandshake, "from-pink-500 to-rose-600", ["Attendance View", "Marks", "Fee Status", "Circulars"], "₹42,999", "₹25,999"),
  mk("edu-21", "Student Portal System", "Student Portal", "Education", "Timetable, assignments, results and fee dues for the student.", Users, "from-blue-500 to-indigo-600", ["Timetable", "Assignments", "Results", "Fee Dues"], "₹42,999", "₹25,999"),
  mk("edu-22", "Teacher Portal System", "Teacher Portal", "Education", "Class lists, attendance marking, grading and parent messages.", MonitorPlay, "from-emerald-600 to-teal-700", ["Class Lists", "Mark Attendance", "Grading", "Messaging"], "₹42,999", "₹25,999"),
  mk("edu-23", "School Fee Management System", "School Fees", "Education", "Fee heads, instalments, concessions, receipts and dues follow-up.", CreditCard, "from-lime-500 to-green-600", ["Fee Heads", "Instalments", "Concessions", "Dues Follow-up"], "₹54,999", "₹32,999"),
  mk("edu-24", "College Fee Management System", "College Fees", "Education", "Semester fees, hostel and exam fees with online collection.", Wallet, "from-green-600 to-emerald-700", ["Semester Fees", "Hostel Fees", "Online Payment", "Receipts"], "₹57,999", "₹34,999"),
  mk("edu-25", "Scholarship Management System", "Scholarships", "Education", "Scheme rules, applications, verification and disbursement tracking.", Award, "from-amber-600 to-orange-700", ["Scheme Rules", "Applications", "Verification", "Disbursement"], "₹49,999", "₹29,999"),
  mk("edu-26", "Hostel Management System", "Hostel", "Education", "Room allotment, mess, gate pass, complaints and hostel fees.", Home, "from-orange-600 to-red-600", ["Room Allotment", "Mess", "Gate Pass", "Complaints"], "₹54,999", "₹32,999"),
  mk("edu-27", "Library Management System", "Library", "Education", "Catalogue, issue and return, fines, reservations and stock audit.", Library, "from-yellow-600 to-amber-700", ["Catalogue", "Issue/Return", "Fines", "Stock Audit"], "₹47,999", "₹28,999"),
  mk("edu-28", "Transportation Management System", "Transport", "Education", "Routes, stops, vehicle documents, driver duty and transport fees.", Bus, "from-yellow-500 to-orange-600", ["Routes", "Stops", "Vehicle Docs", "Transport Fees"], "₹57,999", "₹34,999"),
  mk("edu-29", "School Bus Tracking System", "Bus Tracking", "Education", "Live bus location, pickup and drop alerts and trip history for parents.", MapPin, "from-red-500 to-rose-600", ["Live Location", "Pickup Alerts", "Trip History", "Geofence"], "₹62,999", "₹37,999"),
  mk("edu-30", "Campus Management System", "Campus", "Education", "Blocks, rooms, assets, visitors and events across a campus.", Building2, "from-slate-600 to-gray-700", ["Blocks & Rooms", "Assets", "Visitors", "Events"], "₹69,999", "₹41,999"),
  mk("edu-31", "University Campus Management System", "University Campus", "Education", "Multi-campus estates, shared facilities and central booking.", Building, "from-gray-600 to-slate-800", ["Multi-campus", "Facilities", "Central Booking", "Utilities"], "₹89,999", "₹53,999"),
  mk("edu-32", "Student Accommodation Management System", "Accommodation", "Education", "Bed inventory, tenancy agreements, rent and maintenance requests.", Home, "from-teal-600 to-cyan-700", ["Bed Inventory", "Tenancy", "Rent", "Maintenance"], "₹59,999", "₹35,999"),
  mk("edu-33", "Placement Management System", "Placements", "Education", "Recruiter drives, eligibility, interview rounds and offer tracking.", Briefcase, "from-blue-600 to-sky-700", ["Recruiter Drives", "Eligibility", "Rounds", "Offers"], "₹64,999", "₹38,999"),
  mk("edu-34", "Career Services Management System", "Career Services", "Education", "Counselling, resume reviews, workshops and employer relations.", Target, "from-sky-600 to-blue-700", ["Counselling", "Resume Review", "Workshops", "Employers"], "₹57,999", "₹34,999"),
  mk("edu-35", "Internship Management System", "Internships", "Education", "Internship postings, mentor allocation, logbooks and evaluation.", ClipboardList, "from-cyan-600 to-sky-700", ["Postings", "Mentors", "Logbooks", "Evaluation"], "₹54,999", "₹32,999"),
  mk("edu-36", "Alumni Management System", "Alumni", "Education", "Alumni directory, chapters, events, donations and mentorship.", Users, "from-purple-500 to-fuchsia-600", ["Directory", "Chapters", "Events", "Donations"], "₹52,999", "₹31,999"),
  mk("edu-37", "Education CRM", "Education CRM", "Education", "Lead capture, counsellor pipeline, follow-ups and conversion reports.", TrendingUp, "from-fuchsia-500 to-pink-600", ["Lead Capture", "Pipeline", "Follow-ups", "Conversion"], "₹64,999", "₹38,999"),
  mk("edu-38", "Admissions CRM", "Admissions CRM", "Education", "Enquiry sources, campaign attribution and admission funnel stages.", BarChart3, "from-pink-600 to-rose-700", ["Sources", "Attribution", "Funnel", "Counsellor KPIs"], "₹67,999", "₹40,999"),
  mk("edu-39", "Student Recruitment System", "Recruitment", "Education", "Agent network, applications, document checks and visa milestones.", Globe, "from-blue-600 to-cyan-700", ["Agents", "Applications", "Document Checks", "Visa Milestones"], "₹74,999", "₹44,999"),
  mk("edu-40", "Enrollment Management System", "Enrollment", "Education", "Seat planning, intake targets, waitlists and enrolment reporting.", ClipboardList, "from-emerald-600 to-green-700", ["Seat Planning", "Intake Targets", "Waitlists", "Reporting"], "₹62,999", "₹37,999"),
  mk("edu-41", "Online Course Platform", "Online Courses", "Education", "Sell courses with checkout, drip content, certificates and coupons.", MonitorPlay, "from-violet-500 to-purple-600", ["Checkout", "Drip Content", "Certificates", "Coupons"], "₹74,999", "₹44,999"),
  mk("edu-42", "E-Learning Platform", "E-Learning", "Education", "Self-paced learning paths, progress tracking and completion rules.", BookOpen, "from-purple-600 to-indigo-700", ["Learning Paths", "Progress", "Completion Rules", "Badges"], "₹79,999", "₹47,999"),
  mk("edu-43", "Virtual Classroom System", "Virtual Classroom", "Education", "Live classes with whiteboard, breakout rooms, polls and recordings.", Video, "from-red-600 to-rose-700", ["Live Classes", "Whiteboard", "Breakout Rooms", "Recordings"], "₹84,999", "₹50,999"),
  mk("edu-44", "Online Tutoring Platform", "Online Tutoring", "Education", "Tutor profiles, slot booking, sessions, wallet and payouts.", Presentation, "from-orange-500 to-red-600", ["Tutor Profiles", "Slot Booking", "Wallet", "Payouts"], "₹72,999", "₹43,999"),
  mk("edu-45", "Coaching Institute Management System", "Coaching Institute", "Education", "Batches, test series, doubt sessions and fee instalments.", School, "from-amber-500 to-orange-600", ["Batches", "Test Series", "Doubt Sessions", "Instalments"], "₹62,999", "₹37,999"),
  mk("edu-46", "Tuition Center Management System", "Tuition Center", "Education", "Small-centre batches, daily attendance, fees and parent updates.", BookOpen, "from-lime-600 to-green-700", ["Batches", "Daily Attendance", "Fees", "Parent Updates"], "₹44,999", "₹26,999"),
  mk("edu-47", "Training Institute Management System", "Training Institute", "Education", "Programmes, trainers, cohorts, attendance and certification.", Briefcase, "from-teal-600 to-emerald-700", ["Programmes", "Trainers", "Cohorts", "Certification"], "₹59,999", "₹35,999"),
  mk("edu-48", "Vocational Training Management System", "Vocational Training", "Education", "Trades, practical hours, assessors and apprenticeship records.", Wrench, "from-stone-500 to-neutral-700", ["Trades", "Practical Hours", "Assessors", "Apprenticeships"], "₹64,999", "₹38,999"),
  mk("edu-49", "Skill Development Management System", "Skill Development", "Education", "Skill frameworks, scheme funding, batches and outcome tracking.", Target, "from-emerald-500 to-teal-700", ["Skill Frameworks", "Scheme Funding", "Batches", "Outcomes"], "₹67,999", "₹40,999"),
  mk("edu-50", "Coding School Management System", "Coding School", "Education", "Cohorts, assignments, code reviews and mentor allocation.", Code, "from-slate-600 to-blue-700", ["Cohorts", "Assignments", "Code Reviews", "Mentors"], "₹69,999", "₹41,999"),
  mk("edu-51", "Coding Bootcamp Management System", "Coding Bootcamp", "Education", "Intensive cohorts, sprints, placements and income-share tracking.", Code, "from-blue-700 to-violet-700", ["Sprints", "Placements", "ISA Tracking", "Mentor Hours"], "₹79,999", "₹47,999"),
  mk("edu-52", "Programming Learning Platform", "Programming Learning", "Education", "Lessons with an in-browser editor, test cases and auto-grading.", Laptop, "from-cyan-600 to-blue-700", ["In-browser Editor", "Test Cases", "Auto Grading", "Leaderboard"], "₹84,999", "₹50,999"),
  mk("edu-53", "STEM Education Management System", "STEM Education", "Education", "Lab kits, experiments, project work and competency tracking.", FlaskConical, "from-indigo-600 to-cyan-700", ["Lab Kits", "Experiments", "Projects", "Competency"], "₹67,999", "₹40,999"),
  mk("edu-54", "Language School Management System", "Language School", "Education", "Levels, placement tests, speaking practice and certification.", Languages, "from-rose-500 to-orange-600", ["Levels", "Placement Tests", "Speaking Practice", "Certification"], "₹57,999", "₹34,999"),
  mk("edu-55", "Music School Management System", "Music School", "Education", "Instruments, one-to-one slots, practice logs and recitals.", Music, "from-fuchsia-600 to-purple-700", ["Instruments", "One-to-one Slots", "Practice Logs", "Recitals"], "₹54,999", "₹32,999"),
  mk("edu-56", "Art School Management System", "Art School", "Education", "Studios, materials, portfolio reviews and exhibitions.", Palette, "from-pink-500 to-fuchsia-600", ["Studios", "Materials", "Portfolio Reviews", "Exhibitions"], "₹54,999", "₹32,999"),
  mk("edu-57", "Special Education Management System", "Special Education", "Education", "Individual education plans, therapies, goals and progress notes.", HeartHandshake, "from-teal-500 to-emerald-600", ["IEPs", "Therapies", "Goals", "Progress Notes"], "₹69,999", "₹41,999"),
  mk("edu-58", "Early Childhood Education Management System", "Early Childhood", "Education", "Developmental milestones, activity plans and daily parent reports.", Baby, "from-amber-400 to-orange-500", ["Milestones", "Activity Plans", "Daily Reports", "Photos"], "₹52,999", "₹31,999"),
  mk("edu-59", "Preschool Management System", "Preschool", "Education", "Enrolment, staff ratios, nap and meal logs and pickup authorisation.", Baby, "from-orange-400 to-rose-500", ["Enrolment", "Staff Ratios", "Meal Logs", "Pickup Auth"], "₹49,999", "₹29,999"),
  mk("edu-60", "Daycare Management System", "Daycare", "Education", "Check-in and check-out, hourly billing, incidents and parent feed.", Clock, "from-rose-400 to-pink-600", ["Check-in/out", "Hourly Billing", "Incidents", "Parent Feed"], "₹47,999", "₹28,999"),
  mk("edu-61", "Montessori Management System", "Montessori", "Education", "Work cycles, material tracking and observation records per child.", Puzzle, "from-amber-500 to-yellow-600", ["Work Cycles", "Materials", "Observations", "Reports"], "₹52,999", "₹31,999"),
  mk("edu-62", "Digital Classroom Management System", "Digital Classroom", "Education", "Device control, screen sharing, quizzes and classroom analytics.", MonitorPlay, "from-blue-600 to-indigo-700", ["Device Control", "Screen Share", "Quizzes", "Analytics"], "₹64,999", "₹38,999"),
  mk("edu-63", "Smart School Management System", "Smart School", "Education", "IoT attendance, smart boards, energy and safety monitoring.", Cpu, "from-cyan-600 to-indigo-700", ["IoT Attendance", "Smart Boards", "Energy", "Safety"], "₹89,999", "₹53,999"),
  mk("edu-64", "School Communication Platform", "School Communication", "Education", "Circulars, SMS, email and push with delivery and read receipts.", Bell, "from-sky-500 to-cyan-600", ["Circulars", "SMS/Email/Push", "Delivery Reports", "Groups"], "₹44,999", "₹26,999"),
  mk("edu-65", "Parent-Teacher Communication System", "Parent-Teacher", "Education", "Direct messaging, meeting slots, notes and translation.", MessageSquare, "from-emerald-500 to-cyan-600", ["Messaging", "Meeting Slots", "Notes", "Translation"], "₹42,999", "₹25,999"),
  mk("edu-66", "Education Content Management System", "Education CMS", "Education", "Lesson content, versioning, reviews and multi-board mapping.", FileText, "from-violet-600 to-blue-700", ["Content Library", "Versioning", "Reviews", "Board Mapping"], "₹59,999", "₹35,999"),
  mk("edu-67", "Digital Library Management System", "Digital Library", "Education", "E-books, journals, access rights, lending windows and usage stats.", Library, "from-amber-600 to-yellow-700", ["E-books", "Journals", "Access Rights", "Usage Stats"], "₹57,999", "₹34,999"),
  mk("edu-68", "Research Management System", "Research", "Education", "Projects, grants, ethics approvals, outputs and collaborators.", Microscope, "from-indigo-600 to-purple-700", ["Projects", "Grants", "Ethics", "Outputs"], "₹79,999", "₹47,999"),
  mk("edu-69", "PhD Management System", "PhD Management", "Education", "Scholars, supervisors, coursework, progress reviews and viva.", GraduationCap, "from-purple-700 to-violet-800", ["Scholars", "Supervisors", "Progress Reviews", "Viva"], "₹74,999", "₹44,999"),
  mk("edu-70", "Academic Research Repository", "Research Repository", "Education", "Theses and papers with DOIs, embargoes, licences and search.", Database, "from-slate-600 to-indigo-700", ["DOIs", "Embargoes", "Licences", "Full-text Search"], "₹69,999", "₹41,999"),
  mk("edu-71", "Faculty Research Management System", "Faculty Research", "Education", "Publications, citations, funding and appraisal evidence per faculty.", BarChart3, "from-blue-700 to-slate-800", ["Publications", "Citations", "Funding", "Appraisal"], "₹67,999", "₹40,999"),
  mk("edu-72", "Accreditation Management System", "Accreditation", "Education", "Criteria, evidence collection, self-study reports and audit trail.", BadgeCheck, "from-emerald-600 to-teal-700", ["Criteria", "Evidence", "Self-study Report", "Audit Trail"], "₹84,999", "₹50,999"),
  mk("edu-73", "Quality Assurance Management System", "Quality Assurance", "Education", "Feedback cycles, audits, corrective actions and review meetings.", ShieldCheck, "from-teal-700 to-emerald-800", ["Feedback Cycles", "Audits", "Corrective Actions", "Reviews"], "₹72,999", "₹43,999"),
  mk("edu-74", "Education Analytics Platform", "Education Analytics", "Education", "Institution-wide dashboards for enrolment, outcomes and finance.", BarChart3, "from-cyan-600 to-blue-700", ["Dashboards", "Enrolment Trends", "Outcomes", "Finance"], "₹89,999", "₹53,999"),
  mk("edu-75", "Student Performance Analytics System", "Performance Analytics", "Education", "Early-warning signals, cohort comparison and intervention tracking.", TrendingUp, "from-blue-600 to-violet-700", ["Early Warning", "Cohort Compare", "Interventions", "Predictions"], "₹79,999", "₹47,999"),
  mk("edu-76", "AI Education Assistant", "AI Assistant", "Education", "Answers from your own course material, with citations to the source.", Bot, "from-fuchsia-600 to-violet-700", ["Course-aware Answers", "Citations", "Summaries", "Study Plans"], "₹94,999", "₹56,999"),
  mk("edu-77", "AI Tutoring Platform", "AI Tutoring", "Education", "Adaptive practice that moves with the learner and explains each step.", Sparkles, "from-violet-600 to-fuchsia-700", ["Adaptive Practice", "Step Explanations", "Hints", "Mastery Map"], "₹99,999", "₹59,999"),
  mk("edu-78", "Exam Proctoring System", "Exam Proctoring", "Education", "Identity checks, browser lock, flagged events and reviewer queue.", Shield, "from-red-600 to-rose-700", ["Identity Check", "Browser Lock", "Flagged Events", "Reviewer Queue"], "₹84,999", "₹50,999"),
  mk("edu-79", "Learning Analytics System", "Learning Analytics", "Education", "Engagement, time-on-task and content effectiveness across courses.", BarChart3, "from-sky-600 to-indigo-700", ["Engagement", "Time on Task", "Content Effectiveness", "Alerts"], "₹74,999", "₹44,999"),
  mk("edu-80", "Education Marketplace Platform", "Education Marketplace", "Education", "List courses and institutes, take bookings and settle payouts.", Store, "from-emerald-600 to-cyan-700", ["Listings", "Bookings", "Commissions", "Payouts"], "₹1,09,999", "₹65,999"),

  // 18. Real Estate — the eighty titles the owner listed, in that order.
  // Features are mapped to what each title actually does: a listing portal gets
  // search and media, a lease system gets renewals and escalations, an auction
  // gets bids and deposits. Nothing carries a generic set it has no use for.
  mk("re-1", "Real Estate Management System", "Real Estate Management", "Real Estate", "Properties, owners, agents and transactions on one ledger.", Building2, "from-amber-600 to-orange-700", ["Property Register", "Owners & Agents", "Transactions", "Reports"], "₹74,999", "₹44,999"),
  mk("re-2", "Property Management System", "Property Management", "Real Estate", "Units, tenancies, rent, maintenance and statements per property.", Home, "from-orange-600 to-red-600", ["Unit Register", "Tenancies", "Rent Ledger", "Maintenance"], "₹69,999", "₹41,999"),
  mk("re-3", "Real Estate CRM", "Real Estate CRM", "Real Estate", "Enquiry to closure with site visits, follow-ups and agent pipelines.", Users, "from-blue-600 to-indigo-700", ["Lead Pipeline", "Site Visits", "Follow-ups", "WhatsApp/SMS"], "₹64,999", "₹38,999"),
  mk("re-4", "Real Estate ERP", "Real Estate ERP", "Real Estate", "Sales, projects, procurement, finance and HR for a property business.", Layers, "from-slate-600 to-indigo-800", ["Sales", "Projects", "Procurement", "Finance"], "₹1,19,999", "₹71,999"),
  mk("re-5", "Property Listing Management System", "Listing Management", "Real Estate", "Create, enrich and syndicate listings with media and status control.", LayoutGrid, "from-cyan-600 to-blue-700", ["Listing Builder", "Media Library", "Status Control", "Syndication"], "₹57,999", "₹34,999"),
  mk("re-6", "Real Estate Marketplace Platform", "Marketplace", "Real Estate", "Multi-seller property marketplace with enquiries, plans and payouts.", Store, "from-emerald-600 to-teal-700", ["Multi-seller", "Enquiries", "Subscription Plans", "Payouts"], "₹1,09,999", "₹65,999"),
  mk("re-7", "Property Search Portal", "Search Portal", "Real Estate", "Buyer-facing search with filters, saved searches and map results.", Search, "from-sky-500 to-cyan-600", ["Faceted Filters", "Saved Searches", "Map Results", "Alerts"], "₹74,999", "₹44,999"),
  mk("re-8", "Real Estate Agent Management System", "Agent Management", "Real Estate", "Agent onboarding, territories, targets and performance.", UserCheck, "from-indigo-500 to-blue-700", ["Onboarding", "Territories", "Targets", "Performance"], "₹59,999", "₹35,999"),
  mk("re-9", "Real Estate Broker Management System", "Broker Management", "Real Estate", "Broker registry, deal splits, payouts and compliance documents.", Handshake, "from-violet-600 to-indigo-700", ["Broker Registry", "Deal Splits", "Payouts", "Compliance Docs"], "₹64,999", "₹38,999"),
  mk("re-10", "Real Estate Agency Management System", "Agency Management", "Real Estate", "Branches, teams, listings and commissions across an agency.", Briefcase, "from-blue-700 to-slate-800", ["Branches", "Teams", "Shared Listings", "Commissions"], "₹72,999", "₹43,999"),
  mk("re-11", "Property Sales Management System", "Property Sales", "Real Estate", "Booking to registry: allotment, payment schedule and demand letters.", Tag, "from-green-600 to-emerald-700", ["Allotment", "Payment Schedule", "Demand Letters", "Registry"], "₹79,999", "₹47,999"),
  mk("re-12", "Property Rental Management System", "Rentals", "Real Estate", "Availability, applications, agreements and monthly rent runs.", Key, "from-teal-600 to-cyan-700", ["Availability", "Applications", "Agreements", "Rent Run"], "₹64,999", "₹38,999"),
  mk("re-13", "Lease Management System", "Lease Management", "Real Estate", "Lease terms, escalations, renewals, break clauses and expiry alerts.", FileText, "from-amber-600 to-yellow-700", ["Lease Terms", "Escalations", "Renewals", "Expiry Alerts"], "₹69,999", "₹41,999"),
  mk("re-14", "Tenant Management System", "Tenants", "Real Estate", "Tenant records, KYC, dues, complaints and move-in/move-out.", Users, "from-cyan-500 to-teal-600", ["Tenant KYC", "Dues", "Complaints", "Move-in/out"], "₹57,999", "₹34,999"),
  mk("re-15", "Landlord Management System", "Landlords", "Real Estate", "Owner statements, payouts, expenses and portfolio visibility.", Wallet, "from-lime-600 to-green-700", ["Owner Statements", "Payouts", "Expenses", "Portfolio View"], "₹59,999", "₹35,999"),
  mk("re-16", "Property Portfolio Management System", "Portfolio", "Real Estate", "Yield, occupancy and valuation across a whole portfolio.", PieChart, "from-purple-600 to-violet-700", ["Yield", "Occupancy", "Valuation", "Benchmarks"], "₹84,999", "₹50,999"),
  mk("re-17", "Commercial Property Management System", "Commercial Property", "Real Estate", "Office and retail leases with CAM charges and fit-out tracking.", Building, "from-slate-600 to-blue-800", ["CAM Charges", "Fit-out", "Anchor Tenants", "Escalations"], "₹89,999", "₹53,999"),
  mk("re-18", "Residential Property Management System", "Residential Property", "Real Estate", "Flats and villas with tenancies, society dues and resident requests.", Home, "from-orange-500 to-amber-600", ["Flats & Villas", "Tenancies", "Society Dues", "Requests"], "₹67,999", "₹40,999"),
  mk("re-19", "Vacation Rental Management System", "Vacation Rentals", "Real Estate", "Nightly rates, channel sync, housekeeping and guest messaging.", Sun, "from-sky-500 to-blue-600", ["Nightly Rates", "Channel Sync", "Housekeeping", "Guest Messaging"], "₹79,999", "₹47,999"),
  mk("re-20", "Short-Term Rental Management System", "Short-Term Rentals", "Real Estate", "Short stays with dynamic pricing, deposits and check-in codes.", Clock, "from-blue-600 to-cyan-700", ["Dynamic Pricing", "Deposits", "Check-in Codes", "Calendars"], "₹74,999", "₹44,999"),
  mk("re-21", "Property Booking System", "Property Booking", "Real Estate", "Online booking with slot holds, tokens and confirmation documents.", Calendar, "from-emerald-500 to-green-600", ["Slot Holds", "Token Payment", "Confirmations", "Cancellations"], "₹62,999", "₹37,999"),
  mk("re-22", "Property Reservation System", "Reservations", "Real Estate", "Unit blocking, waitlists, expiry rules and release automation.", ClipboardList, "from-teal-500 to-emerald-600", ["Unit Blocking", "Waitlists", "Expiry Rules", "Auto Release"], "₹59,999", "₹35,999"),
  mk("re-23", "Real Estate Lead Management System", "Lead Management", "Real Estate", "Capture, score, assign and chase every enquiry to an outcome.", Target, "from-rose-500 to-pink-600", ["Capture", "Scoring", "Assignment", "Outcome Tracking"], "₹57,999", "₹34,999"),
  mk("re-24", "Real Estate Lead Generation Platform", "Lead Generation", "Real Estate", "Landing pages, campaigns and portal feeds into one lead pool.", TrendingUp, "from-pink-600 to-fuchsia-700", ["Landing Pages", "Campaigns", "Portal Feeds", "Attribution"], "₹67,999", "₹40,999"),
  mk("re-25", "Real Estate Marketing Automation System", "Marketing Automation", "Real Estate", "Drip journeys over email, SMS and WhatsApp with listing content.", Zap, "from-fuchsia-600 to-purple-700", ["Drip Journeys", "Email/SMS", "WhatsApp", "Segments"], "₹72,999", "₹43,999"),
  mk("re-26", "Real Estate Listing Portal", "Listing Portal", "Real Estate", "Public portal with SEO pages, enquiry forms and agent profiles.", Globe, "from-blue-500 to-indigo-600", ["SEO Pages", "Enquiry Forms", "Agent Profiles", "Sitemaps"], "₹79,999", "₹47,999"),
  mk("re-27", "Multiple Listing Service (MLS) Platform", "MLS", "Real Estate", "Shared inventory between member offices with rules and co-broke splits.", Network, "from-indigo-700 to-violet-800", ["Shared Inventory", "Membership Rules", "Co-broke Splits", "Data Feeds"], "₹1,19,999", "₹71,999"),
  mk("re-28", "Real Estate Website Builder", "Website Builder", "Real Estate", "Agency sites from templates with listing blocks and lead forms.", LayoutGrid, "from-cyan-600 to-sky-700", ["Templates", "Listing Blocks", "Lead Forms", "Custom Domain"], "₹64,999", "₹38,999"),
  mk("re-29", "Property Website Management System", "Property Websites", "Real Estate", "A microsite per project with plans, gallery and booking enquiry.", Monitor, "from-sky-600 to-blue-700", ["Project Microsites", "Floor Plans", "Gallery", "Enquiry"], "₹59,999", "₹35,999"),
  mk("re-30", "Real Estate Document Management System", "Documents", "Real Estate", "Deeds, agreements and KYC with versions, access rules and expiry.", FileText, "from-slate-500 to-gray-700", ["Versioning", "Access Rules", "Expiry Alerts", "Full-text Search"], "₹57,999", "₹34,999"),
  mk("re-31", "Real Estate Contract Management System", "Contracts", "Real Estate", "Clause library, approvals, obligations and renewal calendar.", ClipboardList, "from-gray-600 to-slate-800", ["Clause Library", "Approvals", "Obligations", "Renewal Calendar"], "₹69,999", "₹41,999"),
  mk("re-32", "Digital Lease Agreement System", "Digital Lease", "Real Estate", "Draft, e-sign, stamp and store a lease without paper.", PenTool, "from-emerald-600 to-teal-700", ["Templates", "E-sign", "e-Stamping", "Audit Trail"], "₹64,999", "₹38,999"),
  mk("re-33", "Property Inspection Management System", "Inspections", "Real Estate", "Checklists, photo evidence, defects and signed inspection reports.", ScanLine, "from-amber-500 to-orange-600", ["Checklists", "Photo Evidence", "Defect Log", "Signed Reports"], "₹57,999", "₹34,999"),
  mk("re-34", "Property Maintenance Management System", "Maintenance", "Real Estate", "Work orders, vendors, SLAs, parts and preventive schedules.", Wrench, "from-orange-600 to-red-700", ["Work Orders", "Vendors", "SLA Tracking", "Preventive Schedule"], "₹64,999", "₹38,999"),
  mk("re-35", "Facilities Management System", "Facilities", "Real Estate", "Assets, AMCs, energy, housekeeping and helpdesk for a facility.", Server, "from-cyan-700 to-blue-800", ["Asset Register", "AMC", "Energy", "Helpdesk"], "₹84,999", "₹50,999"),
  mk("re-36", "Building Management System", "Building Management", "Real Estate", "Lifts, HVAC, fire and access systems watched from one console.", Cpu, "from-blue-700 to-indigo-800", ["Lift & HVAC", "Fire Safety", "Access Control", "Alarms"], "₹94,999", "₹56,999"),
  mk("re-37", "Community Management System", "Community", "Real Estate", "Residents, notices, amenities, polls and community billing.", Users, "from-teal-500 to-emerald-700", ["Resident Directory", "Notices", "Amenities", "Polls"], "₹62,999", "₹37,999"),
  mk("re-38", "Homeowners Association (HOA) Management System", "HOA", "Real Estate", "Dues, budgets, violations, board meetings and reserve funds.", Landmark, "from-indigo-600 to-blue-800", ["Dues", "Budgets", "Violations", "Board Meetings"], "₹74,999", "₹44,999"),
  mk("re-39", "Condominium Management System", "Condominium", "Real Estate", "Units, share ratios, common charges and owner meetings.", Building2, "from-violet-600 to-purple-800", ["Units", "Share Ratios", "Common Charges", "Owner Meetings"], "₹72,999", "₹43,999"),
  mk("re-40", "Apartment Management System", "Apartments", "Real Estate", "Flats, residents, visitors, parking and monthly maintenance.", Home, "from-amber-500 to-orange-700", ["Flats", "Visitors", "Parking", "Maintenance Bills"], "₹57,999", "₹34,999"),
  mk("re-41", "Housing Society Management System", "Housing Society", "Real Estate", "Society accounts, sinking fund, notices and committee records.", Building, "from-green-600 to-teal-700", ["Society Accounts", "Sinking Fund", "Notices", "Committee"], "₹59,999", "₹35,999"),
  mk("re-42", "Real Estate Accounting System", "Real Estate Accounting", "Real Estate", "Chart of accounts, invoices, TDS, GST and property-wise P&L.", Calculator, "from-lime-600 to-green-700", ["Invoices", "TDS/GST", "Property P&L", "Bank Reconciliation"], "₹79,999", "₹47,999"),
  mk("re-43", "Property Accounting System", "Property Accounting", "Real Estate", "Per-property ledgers, escrow, owner draws and trust accounting.", Wallet, "from-green-700 to-emerald-800", ["Property Ledgers", "Escrow", "Owner Draws", "Trust Accounting"], "₹74,999", "₹44,999"),
  mk("re-44", "Rent Collection Management System", "Rent Collection", "Real Estate", "Auto-debit, reminders, part payments, late fees and receipts.", Receipt, "from-emerald-500 to-green-700", ["Auto-debit", "Reminders", "Late Fees", "Receipts"], "₹54,999", "₹32,999"),
  mk("re-45", "Security Deposit Management System", "Security Deposits", "Real Estate", "Deposit holding, deductions with evidence, and refund workflow.", Lock, "from-slate-600 to-zinc-700", ["Deposit Holding", "Deductions", "Evidence", "Refunds"], "₹49,999", "₹29,999"),
  mk("re-46", "Real Estate Commission Management System", "Commissions", "Real Estate", "Slabs, splits, clawbacks and payout runs for agents and brokers.", Percent, "from-fuchsia-500 to-rose-600", ["Slabs", "Splits", "Clawbacks", "Payout Runs"], "₹62,999", "₹37,999"),
  mk("re-47", "Real Estate Investment Management System", "Investment Management", "Real Estate", "Funds, investors, capital calls, distributions and NAV.", TrendingUp, "from-blue-700 to-violet-800", ["Funds", "Capital Calls", "Distributions", "NAV"], "₹1,09,999", "₹65,999"),
  mk("re-48", "Real Estate Investment Analysis Platform", "Investment Analysis", "Real Estate", "IRR, cap rate, cash-on-cash and scenario modelling per deal.", BarChart3, "from-violet-700 to-indigo-800", ["IRR & Cap Rate", "Cash Flow Model", "Scenarios", "Deal Compare"], "₹94,999", "₹56,999"),
  mk("re-49", "Real Estate Crowdfunding Platform", "Crowdfunding", "Real Estate", "Offerings, investor KYC, subscriptions and distribution waterfalls.", Coins, "from-amber-600 to-yellow-700", ["Offerings", "Investor KYC", "Subscriptions", "Waterfalls"], "₹1,19,999", "₹71,999"),
  mk("re-50", "Real Estate Asset Management System", "Asset Management", "Real Estate", "Asset lifecycle, capex plans, depreciation and disposal.", Package, "from-stone-600 to-neutral-800", ["Asset Lifecycle", "Capex Plans", "Depreciation", "Disposal"], "₹84,999", "₹50,999"),
  mk("re-51", "Real Estate Development Management System", "Development", "Real Estate", "Phases, approvals, contractors, milestones and sales launch.", Hammer, "from-orange-700 to-red-800", ["Phases", "Approvals", "Contractors", "Milestones"], "₹99,999", "₹59,999"),
  mk("re-52", "Construction Project Management System", "Construction Projects", "Real Estate", "Schedules, BOQ, site progress, RA bills and safety records.", Ruler, "from-yellow-600 to-orange-700", ["Schedule", "BOQ", "Site Progress", "RA Bills"], "₹99,999", "₹59,999"),
  mk("re-53", "Property Development ERP", "Development ERP", "Real Estate", "Land, design, procurement, construction and sales on one system.", Layers, "from-red-700 to-rose-800", ["Land", "Procurement", "Construction", "Sales"], "₹1,29,999", "₹77,999"),
  mk("re-54", "Land Management System", "Land Management", "Real Estate", "Parcels, survey numbers, boundaries, usage and encumbrances.", Map, "from-green-700 to-lime-800", ["Parcels", "Survey Numbers", "Boundaries", "Encumbrances"], "₹74,999", "₹44,999"),
  mk("re-55", "Land Registry Management System", "Land Registry", "Real Estate", "Mutations, registrations, fees and certified record copies.", Landmark, "from-emerald-700 to-green-900", ["Mutations", "Registrations", "Fee Collection", "Certified Copies"], "₹89,999", "₹53,999"),
  mk("re-56", "Land Acquisition Management System", "Land Acquisition", "Real Estate", "Owner negotiation, awards, compensation and possession tracking.", Handshake, "from-amber-700 to-orange-800", ["Negotiation", "Awards", "Compensation", "Possession"], "₹84,999", "₹50,999"),
  mk("re-57", "Property Valuation System", "Valuation", "Real Estate", "Comparable sales, rate cards, adjustments and valuation reports.", Scale, "from-blue-600 to-slate-700", ["Comparables", "Rate Cards", "Adjustments", "Valuation Report"], "₹72,999", "₹43,999"),
  mk("re-58", "Real Estate Appraisal Management System", "Appraisal", "Real Estate", "Appraiser panel, order routing, review and turnaround tracking.", BadgeCheck, "from-slate-700 to-blue-900", ["Appraiser Panel", "Order Routing", "Review", "Turnaround"], "₹74,999", "₹44,999"),
  mk("re-59", "Property Tax Management System", "Property Tax", "Real Estate", "Assessment, demand generation, collection and arrears notices.", Banknote, "from-teal-700 to-emerald-900", ["Assessment", "Demand", "Collection", "Arrears"], "₹79,999", "₹47,999"),
  mk("re-60", "Mortgage & Loan Management System", "Mortgage & Loans", "Real Estate", "Applications, sanction, disbursement, EMI schedule and foreclosure.", CreditCard, "from-indigo-600 to-blue-800", ["Applications", "Sanction", "EMI Schedule", "Foreclosure"], "₹1,09,999", "₹65,999"),
  mk("re-61", "Real Estate Auction Platform", "Auctions", "Real Estate", "Timed auctions with reserve price, EMD and winner settlement.", Gavel, "from-red-600 to-rose-800", ["Timed Auctions", "Reserve Price", "EMD", "Settlement"], "₹94,999", "₹56,999"),
  mk("re-62", "Property Bidding System", "Bidding", "Real Estate", "Sealed or open bids, increments, proxy bids and bid audit.", Gavel, "from-rose-600 to-pink-800", ["Sealed/Open Bids", "Increments", "Proxy Bids", "Bid Audit"], "₹84,999", "₹50,999"),
  mk("re-63", "Real Estate Document Verification System", "Document Verification", "Real Estate", "Authenticity checks, issuer validation and verification certificates.", ShieldCheck, "from-cyan-700 to-teal-900", ["Authenticity Check", "Issuer Validation", "Certificates", "Audit Log"], "₹74,999", "₹44,999"),
  mk("re-64", "Property Title Management System", "Title Management", "Real Estate", "Chain of title, encumbrance search and title opinion records.", FileText, "from-amber-700 to-yellow-900", ["Chain of Title", "Encumbrance Search", "Title Opinion", "Alerts"], "₹79,999", "₹47,999"),
  mk("re-65", "Real Estate GIS Mapping Platform", "GIS Mapping", "Real Estate", "Parcel layers, zoning overlays and spatial queries on a map.", Map, "from-green-600 to-emerald-800", ["Parcel Layers", "Zoning Overlays", "Spatial Query", "Export"], "₹99,999", "₹59,999"),
  mk("re-66", "Property Location Intelligence System", "Location Intelligence", "Real Estate", "Catchment, amenities, connectivity and neighbourhood scoring.", Compass, "from-sky-600 to-indigo-800", ["Catchment", "Amenities", "Connectivity", "Area Score"], "₹89,999", "₹53,999"),
  mk("re-67", "Real Estate Analytics Platform", "Analytics", "Real Estate", "Sales velocity, inventory ageing, funnel and agent dashboards.", BarChart3, "from-cyan-600 to-blue-800", ["Sales Velocity", "Inventory Ageing", "Funnel", "Dashboards"], "₹89,999", "₹53,999"),
  mk("re-68", "Real Estate Market Intelligence System", "Market Intelligence", "Real Estate", "Micro-market rates, supply pipeline and competitor tracking.", TrendingUp, "from-blue-700 to-cyan-900", ["Micro-market Rates", "Supply Pipeline", "Competitors", "Trends"], "₹94,999", "₹56,999"),
  mk("re-69", "Property Price Prediction System", "Price Prediction", "Real Estate", "Modelled price bands from location, size, age and recent sales.", Sparkles, "from-violet-600 to-fuchsia-800", ["Price Bands", "Feature Weights", "Confidence", "History"], "₹99,999", "₹59,999"),
  mk("re-70", "Real Estate AI Assistant", "AI Assistant", "Real Estate", "Answers on inventory, pricing and documents, citing the record.", Bot, "from-fuchsia-600 to-violet-800", ["Inventory Q&A", "Document Answers", "Citations", "Summaries"], "₹1,09,999", "₹65,999"),
  mk("re-71", "AI Property Recommendation Platform", "AI Recommendations", "Real Estate", "Matches a buyer's budget, area and intent to live inventory.", Sparkles, "from-purple-600 to-indigo-800", ["Buyer Matching", "Budget Fit", "Area Intent", "Ranking"], "₹94,999", "₹56,999"),
  mk("re-72", "Virtual Property Tour Platform", "Virtual Tours", "Real Estate", "360° walkthroughs with hotspots, floor switching and lead capture.", Video, "from-indigo-600 to-blue-800", ["360° Walkthrough", "Hotspots", "Floor Switch", "Lead Capture"], "₹94,999", "₹56,999"),
  mk("re-73", "3D Property Visualization System", "3D Visualization", "Real Estate", "3D models, interior options and daylight views before construction.", Box, "from-violet-700 to-purple-900", ["3D Models", "Interior Options", "Daylight View", "Renders"], "₹1,09,999", "₹65,999"),
  mk("re-74", "Real Estate Digital Signage System", "Digital Signage", "Real Estate", "Screens in offices and sites showing live inventory and offers.", Monitor, "from-slate-600 to-cyan-800", ["Screen Playlists", "Live Inventory", "Offers", "Scheduling"], "₹64,999", "₹38,999"),
  mk("re-75", "Real Estate Referral Management System", "Referrals", "Real Estate", "Referrer registry, tracked links, qualification and reward payouts.", Share2, "from-pink-500 to-rose-700", ["Referrer Registry", "Tracked Links", "Qualification", "Rewards"], "₹57,999", "₹34,999"),
  mk("re-76", "Real Estate Franchise Management System", "Franchise", "Real Estate", "Territories, franchise fees, brand standards and audits.", Building2, "from-amber-600 to-red-700", ["Territories", "Franchise Fees", "Brand Standards", "Audits"], "₹99,999", "₹59,999"),
  mk("re-77", "Real Estate Broker Portal", "Broker Portal", "Real Estate", "Broker login for inventory, bookings, commission and statements.", Briefcase, "from-indigo-600 to-slate-800", ["Inventory Access", "Bookings", "Commission View", "Statements"], "₹62,999", "₹37,999"),
  mk("re-78", "Property Owner Portal", "Owner Portal", "Real Estate", "Owner login for occupancy, rent received, expenses and documents.", Home, "from-emerald-600 to-green-800", ["Occupancy", "Rent Received", "Expenses", "Documents"], "₹57,999", "₹34,999"),
  mk("re-79", "Tenant Portal", "Tenant Portal", "Real Estate", "Tenant login to pay rent, raise complaints and read notices.", Key, "from-cyan-600 to-teal-800", ["Pay Rent", "Complaints", "Notices", "Lease Copy"], "₹52,999", "₹31,999"),
  mk("re-80", "Real Estate Customer Portal", "Customer Portal", "Real Estate", "Buyer login for booking status, payment schedule and possession.", Users, "from-blue-600 to-indigo-800", ["Booking Status", "Payment Schedule", "Documents", "Possession"], "₹57,999", "₹34,999"),

  // Healthcare & Medical — each entry is a software category, not a product,
  // so it names no stack and carries the notice that says so.
  mk("hc-1", "Hospital Management Software", "Hospital Management", "Healthcare", "Complete software for managing hospital operations, patients, staff, appointments, billing, and reports.", Hospital, "from-sky-600 to-blue-700", ["Patient Management", "Appointment Management", "Doctor Management", "Billing", "Pharmacy", "Laboratory", "Reports"], "₹1,24,999", "₹74,999", category("Hospitals, Multi-Specialty Hospitals, Healthcare Centers", "Hospital Management / ERP", "OPD, IPD, Emergency, Ward Management, Staff Management, Medical Records")),
  mk("hc-2", "Clinic Management Software", "Clinic Management", "Healthcare", "Software for managing daily clinic operations, patients, doctors, appointments, billing, and records.", Stethoscope, "from-teal-600 to-cyan-700", ["Patient Registration", "Appointment Scheduling", "Doctor Management", "Billing", "Prescription", "Reports"], "₹64,999", "₹38,999", category("Clinics, Private Practices, Healthcare Centers", "Clinic Management", "Patient History, Follow-ups, Invoices, Doctor Schedule, Notifications")),
  mk("hc-3", "Medical Practice Management Software", "Practice Management", "Healthcare", "Software designed to manage the administrative and operational activities of medical practices.", BriefcaseMedical, "from-indigo-600 to-violet-700", ["Patient Management", "Scheduling", "Billing", "Staff Management", "Reporting", "Medical Records"], "₹69,999", "₹41,999", category("Doctors, Medical Practices, Specialist Clinics", "Practice Management", "Appointment Calendar, Patient Profiles, Billing, Staff Roles")),
  mk("hc-4", "Patient Management Software", "Patient Management", "Healthcare", "Centralized system for managing patient profiles, visits, medical history, and healthcare records.", UserCheck, "from-emerald-600 to-teal-700", ["Patient Registration", "Medical History", "Visit Tracking", "Documents", "Search", "Reports"], "₹59,999", "₹35,999", category("Hospitals, Clinics, Diagnostic Centers", "Healthcare Management", "Patient Profiles, Visit History, Medical Documents, Follow-up Tracking")),
  mk("hc-5", "Electronic Medical Records (EMR) Software", "EMR", "Healthcare", "Digital system for storing and managing patient medical records.", FileText, "from-blue-600 to-indigo-700", ["Medical Records", "Patient History", "Clinical Notes", "Prescriptions", "Documents", "Search"], "₹84,999", "₹50,999", category("Hospitals, Clinics, Medical Practices", "EMR", "Clinical Documentation, Patient Timeline, Doctor Access, Record Management")),
  mk("hc-6", "Electronic Health Records (EHR) Software", "EHR", "Healthcare", "Digital healthcare record platform for managing comprehensive patient health information.", ClipboardList, "from-cyan-600 to-sky-700", ["Patient Records", "Medical History", "Clinical Data", "Prescriptions", "Reports", "Document Management"], "₹94,999", "₹56,999", category("Hospitals, Healthcare Networks, Clinics", "EHR", "Longitudinal Patient Records, Provider Access, Health Information Management")),
  mk("hc-7", "Doctor Appointment Software", "Appointment Management", "Healthcare", "Appointment scheduling system for doctors, patients, clinics, and hospitals.", CalendarClock, "from-violet-600 to-purple-700", ["Online Booking", "Doctor Calendar", "Appointment Slots", "Rescheduling", "Cancellation", "Notifications"], "₹49,999", "₹29,999", category("Doctors, Clinics, Hospitals", "Appointment Management", "Patient Booking, Doctor Availability, SMS/Email Notifications")),
  mk("hc-8", "Hospital Billing Software", "Hospital Billing", "Healthcare", "Billing and financial management software designed for hospital operations.", Receipt, "from-amber-600 to-orange-700", ["Patient Billing", "Invoices", "Payments", "Discounts", "Insurance Billing", "Financial Reports"], "₹74,999", "₹44,999", category("Hospitals, Healthcare Centers", "Billing / Healthcare ERP", "OPD Billing, IPD Billing, Pharmacy Billing, Laboratory Charges")),
  mk("hc-9", "Medical Billing Software", "Medical Billing", "Healthcare", "Software for managing healthcare billing, invoices, payments, and financial records.", CreditCard, "from-orange-600 to-red-700", ["Invoicing", "Payment Tracking", "Billing Reports", "Patient Accounts", "Insurance Billing"], "₹59,999", "₹35,999", category("Clinics, Hospitals, Medical Practices", "Medical Billing", "Billing History, Receipts, Payment Status, Financial Reporting")),
  mk("hc-10", "Medical Insurance Billing Software", "Insurance Billing", "Healthcare", "Software for managing insurance-related medical billing and claim workflows.", ShieldCheck, "from-slate-600 to-gray-700", ["Insurance Claims", "Patient Insurance", "Billing", "Claim Tracking", "Documents", "Reports"], "₹79,999", "₹47,999", category("Hospitals, Clinics, Healthcare Providers", "Insurance Billing", "Claim Records, Policy Information, Claim Status, Billing Documentation", "This is a generic software category/use case. Insurance workflows and integrations vary by country and implementation.")),
  mk("hc-11", "Pharmacy Management Software", "Pharmacy Management", "Healthcare", "Software for managing pharmacy inventory, sales, prescriptions, suppliers, and billing.", Pill, "from-green-600 to-emerald-700", ["Medicine Inventory", "Sales", "Purchase", "Expiry Tracking", "Suppliers", "Billing"], "₹64,999", "₹38,999", category("Pharmacies, Medical Stores, Hospital Pharmacies", "Pharmacy Management / POS", "Batch Management, Expiry Alerts, Stock Control, Purchase Management", "This is a generic software category/use case. Regulatory requirements, integrations, and features may vary by implementation.")),
  mk("hc-12", "Medical Store POS Software", "Medical Store POS", "Healthcare", "Point-of-sale software designed specifically for medical stores and pharmacies.", ScanLine, "from-lime-600 to-green-700", ["POS Billing", "Inventory", "Barcode", "Purchase", "Sales", "Customer Management"], "₹44,999", "₹26,999", category("Medical Stores, Pharmacies", "POS / Inventory", "Barcode Billing, Batch Tracking, Expiry Management, Stock Reports", "This is a generic software category/use case. Features and technology may vary by implementation.")),
  mk("hc-13", "Laboratory Management Software", "Laboratory Management", "Healthcare", "Software for managing laboratory operations, patients, tests, samples, reports, and billing.", FlaskConical, "from-purple-600 to-fuchsia-700", ["Test Management", "Sample Tracking", "Patient Records", "Reports", "Billing", "Technician Management"], "₹79,999", "₹47,999", category("Medical Laboratories, Diagnostic Centers", "Laboratory Management", "Sample Collection, Test Processing, Result Entry, Report Generation", "This is a generic software category/use case. Actual laboratory workflows and integrations vary by implementation.")),
  mk("hc-14", "Diagnostic Center Management Software", "Diagnostic Management", "Healthcare", "Management platform for diagnostic centers handling patients, tests, reports, billing, and staff.", Microscope, "from-fuchsia-600 to-pink-700", ["Patient Registration", "Test Booking", "Sample Management", "Reports", "Billing", "Staff Management"], "₹74,999", "₹44,999", category("Diagnostic Centers, Medical Labs", "Diagnostic Management", "Test Catalog, Sample Collection, Result Processing, Report Delivery", "This is a generic software category/use case. Features and technology may vary by implementation.")),
  mk("hc-15", "Pathology Lab Software", "Pathology Lab", "Healthcare", "Software for managing pathology laboratory tests, samples, patients, reports, and billing.", TestTube, "from-rose-600 to-red-700", ["Test Management", "Sample Tracking", "Result Entry", "Report Generation", "Billing"], "₹69,999", "₹41,999", category("Pathology Labs, Diagnostic Centers", "Laboratory Information Management", "Sample IDs, Test Results, Doctor Referrals, Patient Reports", "This is a generic software category/use case. Laboratory workflows and technology vary by implementation.")),
  mk("hc-16", "Radiology Management Software", "Radiology Management", "Healthcare", "Software for managing radiology departments, procedures, appointments, reports, and records.", Scan, "from-zinc-600 to-slate-700", ["Patient Management", "Radiology Orders", "Scheduling", "Reporting", "Records", "Billing"], "₹89,999", "₹53,999", category("Hospitals, Diagnostic Centers, Radiology Clinics", "Radiology Management", "Imaging Workflow, Radiologist Reports, Patient Records", "This is a generic software category/use case. Imaging integrations and standards vary by implementation.")),
  mk("hc-17", "Dental Clinic Management Software", "Dental Clinic", "Healthcare", "Software for managing dental clinics, patients, appointments, treatments, billing, and records.", Smile, "from-sky-500 to-cyan-600", ["Patient Management", "Dental Charting", "Appointments", "Treatment Plans", "Billing"], "₹59,999", "₹35,999", category("Dental Clinics, Dental Practices", "Dental Practice Management", "Tooth Chart, Treatment History, Follow-ups, Dental Billing", "This is a generic software category/use case. Features and technology may vary by implementation.")),
  mk("hc-18", "Dental Practice Management Software", "Dental Practice", "Healthcare", "Complete management system for dental practices and dental professionals.", Bone, "from-cyan-500 to-teal-600", ["Patient Records", "Scheduling", "Dental Charting", "Treatment Management", "Billing"], "₹64,999", "₹38,999", category("Dentists, Dental Clinics", "Practice Management", "Treatment Plans, Patient History, Doctor Calendar, Payments", "This is a generic software category/use case. Features and technology may vary by implementation.")),
  mk("hc-19", "Veterinary Clinic Software", "Veterinary Management", "Healthcare", "Management software for veterinary clinics, animal hospitals, pet records, appointments, and billing.", PawPrint, "from-amber-500 to-yellow-600", ["Animal Records", "Appointments", "Treatment Records", "Vaccination Tracking", "Billing"], "₹54,999", "₹32,999", category("Veterinary Clinics, Animal Hospitals, Pet Care Centers", "Veterinary Management", "Pet Profiles, Vaccination History, Treatment Records, Owner Management", "This is a generic software category/use case. Features and technology may vary by implementation.")),
  mk("hc-20", "Blood Bank Management Software", "Blood Bank", "Healthcare", "Software for managing blood inventory, donors, blood groups, collections, and distributions.", Droplet, "from-red-600 to-rose-700", ["Donor Management", "Blood Inventory", "Blood Groups", "Collection Records", "Distribution Tracking"], "₹74,999", "₹44,999", category("Blood Banks, Hospitals", "Blood Bank Management", "Blood Units, Compatibility Records, Stock Monitoring, Donor History", "This is a generic software category/use case. Healthcare regulations and workflows vary by jurisdiction and implementation.")),
  mk("hc-21", "Blood Donor Management Software", "Donor Management", "Healthcare", "Platform for managing blood donors, donor records, appointments, eligibility information, and communication.", HeartHandshake, "from-rose-600 to-pink-700", ["Donor Registration", "Donor History", "Scheduling", "Blood Group Management", "Notifications"], "₹49,999", "₹29,999", category("Blood Banks, NGOs, Healthcare Organizations", "Donor Management", "Donor Profiles, Donation History, Eligibility Records", "This is a generic software category/use case. Actual eligibility and medical rules must follow applicable healthcare regulations.")),
  mk("hc-22", "Ambulance Management Software", "Ambulance Management", "Healthcare", "Software for coordinating ambulance fleets, emergency requests, drivers, vehicles, and trip records.", Ambulance, "from-red-500 to-orange-600", ["Ambulance Dispatch", "Driver Management", "Vehicle Tracking", "Emergency Requests", "Trip Records"], "₹69,999", "₹41,999", category("Hospitals, Ambulance Services, Emergency Providers", "Fleet / Emergency Management", "Dispatch, Vehicle Status, Driver Assignment, Trip History", "This is a generic software category/use case. Real-time tracking and emergency integrations depend on implementation.")),
  mk("hc-23", "Emergency Room Management Software", "Emergency Management", "Healthcare", "Software for managing emergency department patients, staff, beds, treatment workflows, and records.", Siren, "from-orange-600 to-red-700", ["Emergency Registration", "Triage Records", "Bed Management", "Patient Tracking", "Billing"], "₹89,999", "₹53,999", category("Hospitals, Emergency Departments", "Emergency Management", "Emergency Queue, Patient Status, Doctor Assignment, Bed Allocation", "This is a generic software category/use case. Clinical workflows and requirements vary by healthcare facility.")),
  mk("hc-24", "ICU Management Software", "ICU Management", "Healthcare", "Software for managing ICU patients, beds, monitoring records, staff, and clinical documentation.", HeartPulse, "from-pink-600 to-rose-700", ["ICU Bed Management", "Patient Records", "Monitoring Data", "Staff Management", "Reports"], "₹99,999", "₹59,999", category("Hospitals, Intensive Care Units", "ICU Management", "Bed Status, Patient Monitoring Records, Doctor/Nurse Assignment", "This is a generic software category/use case. Medical-device integrations and clinical workflows require specific verification.")),
  mk("hc-25", "Operation Theatre Management Software", "OT Management", "Healthcare", "Software for scheduling and managing operation theatre procedures, patients, doctors, and resources.", Syringe, "from-teal-600 to-emerald-700", ["OT Scheduling", "Surgery Records", "Doctor Assignment", "Resource Management", "Billing"], "₹94,999", "₹56,999", category("Hospitals, Surgical Centers", "OT Management", "Surgery Calendar, OT Availability, Staff Assignment, Procedure Records", "This is a generic software category/use case. Clinical and surgical workflows vary by implementation.")),
  mk("hc-26", "Nursing Management Software", "Nursing Management", "Healthcare", "Software for managing nursing staff, schedules, patient assignments, tasks, and records.", Users, "from-blue-500 to-sky-600", ["Nurse Scheduling", "Patient Assignment", "Task Management", "Shift Management", "Reports"], "₹59,999", "₹35,999", category("Hospitals, Nursing Facilities", "Nursing Management", "Shift Roster, Ward Assignment, Task Tracking")),
  mk("hc-27", "Nursing Home Management Software", "Nursing Home", "Healthcare", "Management platform for nursing homes, residents, staff, billing, care plans, and daily operations.", Bed, "from-indigo-500 to-blue-600", ["Resident Management", "Staff Management", "Care Plans", "Billing", "Scheduling"], "₹69,999", "₹41,999", category("Nursing Homes, Care Facilities", "Healthcare Management", "Resident Records, Room Management, Staff Scheduling", "This is a generic software category/use case. Care requirements and regulations vary by location.")),
  mk("hc-28", "Maternity Hospital Management Software", "Maternity Hospital", "Healthcare", "Software for managing maternity hospitals, pregnant patients, appointments, admissions, billing, and records.", Baby, "from-pink-500 to-fuchsia-600", ["Patient Management", "Pregnancy Records", "Appointments", "Admission", "Billing"], "₹84,999", "₹50,999", category("Maternity Hospitals, Gynecology Clinics", "Hospital Management", "Antenatal Records, Delivery Records, Patient History", "This is a generic software category/use case. Clinical workflows and medical requirements vary by provider.")),
  mk("hc-29", "Pediatric Clinic Software", "Pediatric Clinic", "Healthcare", "Management software designed for pediatric clinics and child healthcare providers.", Thermometer, "from-yellow-500 to-amber-600", ["Child Patient Records", "Appointments", "Vaccination Records", "Prescriptions", "Billing"], "₹54,999", "₹32,999", category("Pediatric Clinics, Children's Hospitals", "Clinic Management", "Growth Records, Vaccination History, Pediatric Visits", "This is a generic software category/use case. Clinical requirements vary by implementation.")),
  mk("hc-30", "Physiotherapy Clinic Software", "Physiotherapy Clinic", "Healthcare", "Software for managing physiotherapy patients, sessions, treatment plans, appointments, and billing.", Activity, "from-emerald-500 to-green-600", ["Patient Records", "Therapy Plans", "Session Tracking", "Scheduling", "Billing"], "₹49,999", "₹29,999", category("Physiotherapy Clinics, Rehabilitation Centers", "Clinic Management", "Exercise Plans, Treatment Sessions, Progress Records")),
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
