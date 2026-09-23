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
