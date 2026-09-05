/**
 * 16 Supplied Demos Catalog & Marketplace Mapping
 * 
 * This file defines the exact 16 supplied demos with their demo URLs,
 * categories, and branding requirements. It serves as the single source
 * of truth for the end-to-end wiring:
 * 
 * Demo Manager → Product → Homepage Card → DEMO Button → Branded Gateway
 */

export interface SuppliedDemo {
  // Exact name as supplied
  name: string;
  
  // Product slug for URL routing
  slug: string;
  
  // Exact supplied category
  category: string;
  
  // Master category for Homepage filtering
  masterCategory: string;
  
  // Type/description from supplied data
  type: string;
  
  // Key features from supplied data
  modules: string[];
  
  // Exact demo URL supplied - MUST NOT CHANGE
  demoUrl: string;
  
  // UI icon for card
  iconName: string;
  
  // Color gradient for card
  color: string;
  
  // Branding requirement
  branding?: string;
  
  // Brief description for card
  description: string;
  
  // Tech stack if supplied
  tech?: string[];
  
  // Reference system if supplied
  reference?: string;
}

/**
 * THE 16 EXACT SUPPLIED DEMOS
 * 
 * RULE: Use EXACT data as supplied. Do NOT invent, modify, or skip.
 * RULE: Do NOT create duplicates if demo already exists with exact name.
 * RULE: Do NOT use mock or fake URLs.
 */
export const SUPPLIED_DEMOS_16: SuppliedDemo[] = [
  {
    name: "Delhi Metro App",
    slug: "delhi-metro-app",
    category: "Metro Ticketing",
    masterCategory: "Public Transport",
    type: "Metro Flow & Ticketing System",
    modules: ["Routes/Map", "Journey Planner", "Fare", "QR Ticket", "Smart Card", "Live Status", "History"],
    demoUrl: "https://delhi-ride-ui.lovable.app",
    iconName: "Bus",
    color: "from-blue-600 to-cyan-600",
    branding: "Powered by Software Vala™",
    description: "Metro ticketing with routes, journey planning, QR tickets and live status",
  },
  {
    name: "RetailX Core",
    slug: "retailx-core",
    category: "Retail Billing",
    masterCategory: "Retail & POS",
    type: "Offline Desktop System",
    modules: ["Billing", "Inventory", "Customer", "Supplier", "Reports", "GST Invoice", "Thermal Print", "Offline"],
    demoUrl: "https://retail-heartbeat-92.lovable.app",
    iconName: "ShoppingCart",
    color: "from-purple-600 to-pink-600",
    description: "Offline retail POS with billing, inventory, and thermal printing",
    tech: ["Electron", "React", "SQLite"],
  },
  {
    name: "EduNex Pro",
    slug: "edunex-pro",
    category: "School Management",
    masterCategory: "Education",
    type: "Web-based School Management System",
    modules: ["Students", "Attendance", "Fees", "Exams", "Reports", "Admin", "Teacher", "Student", "Parent"],
    demoUrl: "https://grade-grid-quest.lovable.app",
    iconName: "GraduationCap",
    color: "from-blue-600 to-indigo-600",
    description: "School ERP with student management, attendance, fees and exams",
    tech: ["Next.js", "Node.js", "PostgreSQL"],
  },
  {
    name: "Nepali School Demo",
    slug: "nepali-school-demo",
    category: "School Management",
    masterCategory: "Education",
    type: "School Management System",
    modules: ["Students", "Teachers", "Classes", "Attendance", "Exams", "Results", "Fees", "Dashboard"],
    demoUrl: "https://sl1nk.com/waf8auj",
    iconName: "GraduationCap",
    color: "from-indigo-600 to-blue-600",
    branding: "Software Vala™",
    description: "Comprehensive school management system for Nepali educational institutions with student management, attendance, exams, fees, and reporting",
    tech: ["Web-based", "Modern UI", "Multi-role"],
  },
  {
    name: "Medical Research Institute Management System",
    slug: "medical-research-institute",
    category: "Medical Research",
    masterCategory: "Healthcare",
    type: "Offline APK / Institute Management",
    modules: ["Research Programs", "Studies", "Subjects", "Samples/Biobank", "Protocols", "Compliance", "Inventory", "Reports", "Audit", "Backup"],
    demoUrl: "https://med-sync-vault.lovable.app",
    iconName: "Stethoscope",
    color: "from-green-600 to-teal-600",
    branding: "Software Vala™",
    description: "Clinical research management with compliance, biobank and protocols",
    reference: "Clinical research institutes",
  },
  {
    name: "Fleetio",
    slug: "fleetio",
    category: "Fleet Management",
    masterCategory: "Logistics",
    type: "Fleet Admin Panel",
    modules: ["Dashboard", "Vehicles", "Maintenance", "Drivers", "Fuel Logs", "Reports", "Alerts"],
    demoUrl: "https://vala-fleet-ui.lovable.app",
    iconName: "Truck",
    color: "from-orange-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Fleet management with vehicles, maintenance, drivers and fuel tracking",
  },
  {
    name: "Infra.Market",
    slug: "infra-market",
    category: "Heavy Equipment Transport",
    masterCategory: "Logistics",
    type: "Heavy Logistics Management",
    modules: ["Dashboard", "Equipment", "Transport Booking", "Load Tracking", "Documents", "Payments", "Reports"],
    demoUrl: "https://infra-fleet-view.lovable.app",
    iconName: "Truck",
    color: "from-orange-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Heavy equipment logistics with bookings, tracking and load management",
  },
  {
    name: "Indoor Sports Arena Management",
    slug: "indoor-sports-arena",
    category: "Sports Arena",
    masterCategory: "Sports & Recreation",
    type: "Offline Android APK",
    modules: ["Court Booking", "Courts", "Members", "Coaches", "Memberships", "Attendance", "Payments", "Reports"],
    demoUrl: "https://court-squad-pro.lovable.app",
    iconName: "Users",
    color: "from-red-600 to-pink-600",
    description: "Indoor sports arena with court booking and membership management",
    reference: "Skedda Venue Booking System",
    tech: ["SQLite", "Offline-First", "Android"],
  },
  {
    name: "Blinkit Clone",
    slug: "blinkit-clone",
    category: "Quick Commerce",
    masterCategory: "E-commerce",
    type: "Store Dashboard",
    modules: ["Orders", "Revenue", "Products", "Customers", "Inventory", "Delivery"],
    demoUrl: "https://color-dash-delight.lovable.app",
    iconName: "ShoppingBag",
    color: "from-yellow-600 to-orange-600",
    description: "Quick commerce store dashboard with orders and inventory management",
  },
  {
    name: "BoatBook",
    slug: "boatbook",
    category: "Boat Transport",
    masterCategory: "Travel",
    type: "Boat Booking System",
    modules: ["Search", "Filters", "Listings", "Boat Details", "Booking", "Schedule", "Payment", "History"],
    demoUrl: "https://sea-charms-book.lovable.app",
    iconName: "Anchor",
    color: "from-cyan-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Boat booking platform with search, listings and smooth booking flow",
  },
  {
    name: "Outdoor Sports Complex Management",
    slug: "outdoor-sports-complex",
    category: "Sports Complex",
    masterCategory: "Sports & Recreation",
    type: "Offline Android APK",
    modules: ["Ground Booking", "Grounds", "Tournaments", "Members", "Coaches", "Memberships", "Attendance", "Payments", "Maintenance", "Reports"],
    demoUrl: "https://turf-booker-spark.lovable.app",
    iconName: "Layers",
    color: "from-green-600 to-emerald-600",
    branding: "Powered by Software Vala™",
    description: "Outdoor sports complex with ground booking and tournament management",
    reference: "PerfectMind Recreation Management System",
    tech: ["SQLite", "Offline-First", "Android"],
  },
  {
    name: "Sports Equipment Store",
    slug: "sports-equipment-store",
    category: "Sports Retail / POS & Inventory",
    masterCategory: "Retail & POS",
    type: "Offline Android APK",
    modules: ["New Sale", "Products", "Categories", "Brands", "Customers", "Suppliers", "Purchase", "Inventory", "Reports"],
    demoUrl: "https://sportspark-pos.lovable.app",
    iconName: "ShoppingCart",
    color: "from-blue-600 to-green-600",
    branding: "Powered by Software Vala™",
    description: "Offline-first sports retail POS with barcode scanning, inventory management, multi-user support, and comprehensive sales analytics. Features license key activation and device-bound operation.",
    reference: "Lightspeed Retail POS",
    tech: ["SQLite", "Offline-First", "Key-Based", "Device-Bound", "Android"],
  },
  {
    name: "Data Science Lab Management System",
    slug: "data-science-lab",
    category: "Data Science",
    masterCategory: "Research & Analytics",
    type: "Offline APK",
    modules: ["Lab Management", "Projects", "Data Sets", "Experiments", "Reports"],
    demoUrl: "https://offline-lab-keeper.lovable.app",
    iconName: "BarChart3",
    color: "from-violet-600 to-purple-600",
    description: "Data science lab management with experiments and data tracking",
  },
  {
    name: "Festora™ — Festival Management OS",
    slug: "festora",
    category: "Festival",
    masterCategory: "Event Management",
    type: "Offline APK",
    modules: ["Event Planning", "Vendors", "Scheduling", "Budget", "Attendees", "Logistics"],
    demoUrl: "https://festora-os.lovable.app",
    iconName: "Calendar",
    color: "from-pink-600 to-rose-600",
    description: "Festival management operating system for complete event coordination",
  },
  {
    name: "Dental Clinic Management System",
    slug: "dental-clinic",
    category: "Dental Clinic / Healthcare Management",
    masterCategory: "Healthcare",
    type: "Offline APK",
    modules: ["Tooth Chart", "Patient Records", "Appointments", "Treatment Plans", "Insurance", "Billing", "Patient Communication", "Reports"],
    demoUrl: "https://tooth-chart-buddy.lovable.app",
    iconName: "Stethoscope",
    color: "from-blue-600 to-cyan-600",
    branding: "Powered by Software Vala™",
    description: "Complete dental clinic management system with digital tooth charts, patient records, appointment scheduling, treatment plans, insurance verification, and comprehensive billing - reference Dentrix Practice Management",
    reference: "Dentrix Practice Management",
    tech: ["SQLite", "Offline-First", "Canvas-Based", "Mobile-Optimized"]
  },
  {
    name: "Printora™ — Newspaper OS",
    slug: "printora",
    category: "Newspaper / Publishing Management",
    masterCategory: "Publishing",
    type: "Offline APK",
    modules: ["Layout Editor", "Content Management", "Print Workflow", "Distribution", "Subscriptions", "Advertising", "Analytics", "Editorial Calendar"],
    demoUrl: "https://printora-news-os.lovable.app",
    iconName: "FileText",
    color: "from-gray-600 to-slate-700",
    branding: "Powered by Software Vala™",
    description: "Complete newspaper publishing operating system with digital layout editor, content management, printing workflow, distribution tracking, and subscription management - full production pipeline",
    tech: ["SQLite", "Offline-First", "Canvas-Based", "Journalism-Optimized"]
  },
  {
    name: "Decorixa™ — Stage Decor OS",
    slug: "decorixa",
    category: "Stage Decoration / Event Services Management",
    masterCategory: "Event Services",
    type: "Offline APK",
    modules: ["Design Gallery", "3D Visualization", "Vendor Management", "Quote Generation", "Project Planning", "Budget Tracking", "Scheduling", "Execution"],
    demoUrl: "https://decorix-stage-magic.lovable.app",
    iconName: "Sparkles",
    color: "from-fuchsia-600 to-purple-600",
    branding: "Powered by Software Vala™",
    description: "Complete stage decoration and event services management OS with design gallery, vendor coordination, quote generation, project management, budget tracking, scheduling, and execution workflows",
    tech: ["SQLite", "Offline-First", "3D-Capable", "Event-Optimized"]
  },
  {
    name: "Cinemixa™ — Cinema Hall OS",
    slug: "cinemixa",
    category: "Cinema / Ticketing & Screen Management",
    masterCategory: "Entertainment",
    type: "Offline APK",
    modules: ["Ticketing System", "Screen Scheduling", "Seat Allocation", "Show Management", "Concessions", "Revenue Analytics", "Visitor Management", "Reporting"],
    demoUrl: "https://cinemix-showtime-hub.lovable.app",
    iconName: "Film",
    color: "from-red-600 to-amber-600",
    branding: "Powered by Software Vala™",
    description: "Complete cinema hall management OS with ticketing system, screen scheduling, seat allocation, show management, concession tracking, revenue analytics, and visitor management",
    tech: ["SQLite", "Offline-First", "Interactive-Maps", "Entertainment-Optimized"]
  },
  {
    name: "Restaurant Food Ordering & Management System",
    slug: "restaurant-ordering-system",
    category: "Restaurant / Food Ordering Management",
    masterCategory: "Food & Beverage",
    type: "Flutter Mobile App + Web Admin Panel",
    modules: ["Mobile App", "Web Admin Panel", "Order Management", "Inventory", "Kitchen Display", "Delivery Tracking", "Payment Integration", "Analytics"],
    demoUrl: "https://dine-easy-craft.lovable.app",
    iconName: "UtensilsCrossed",
    color: "from-orange-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Complete restaurant management solution with mobile food ordering app, web admin panel, order tracking, inventory management, kitchen display system, delivery management, and analytics",
    tech: ["Flutter", "Flutter Web", "GetX", "Laravel", "MySQL", "REST API"]
  },
  {
    name: "FishAngler",
    slug: "fishangler",
    category: "Fishing / Boat Service Management",
    masterCategory: "Maritime Services",
    type: "Mobile App",
    modules: ["Catch Tracking", "Trip Planning", "Equipment Inventory", "Crew Management", "Weather Forecasting", "Booking System", "Analytics", "Customer Portal"],
    demoUrl: "https://deepblue-catch-crew.lovable.app",
    iconName: "Anchor",
    color: "from-blue-600 to-teal-600",
    branding: "Powered by Software Vala™",
    description: "Complete fishing and boat service management mobile app with catch tracking, trip planning, equipment inventory, crew management, weather forecasting, and booking system",
    tech: ["React Native", "TypeScript", "Node.js", "Firebase"]
  },
  {
    name: "Esports Arena Management System",
    slug: "esports-arena",
    category: "Esports / Gaming Arena Management",
    masterCategory: "Gaming & Entertainment",
    type: "Offline Android APK",
    modules: ["Tournament Scheduling", "Player Registration", "Team Management", "Equipment Tracking", "Venue Booking", "Revenue Analytics", "Streaming Integration", "Leaderboards"],
    demoUrl: "https://esports-station-wiz.lovable.app",
    iconName: "Gamepad2",
    color: "from-purple-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Complete esports arena and gaming center management system with tournament scheduling, player registration, team management, equipment tracking, revenue analytics, booking system, and streaming integration - reference ggCircuit",
    reference: "ggCircuit Esports Center Management",
    tech: ["SQLite", "Offline-First", "Live-Scoring", "Gaming-Optimized"]
  },
  {
    name: "Arcadixa™ — Gaming Arcade OS",
    slug: "arcadixa",
    category: "Gaming Arcade / Entertainment Management",
    masterCategory: "Gaming & Entertainment",
    type: "Offline APK",
    modules: ["Machine Inventory", "Player Accounts", "Token System", "Tournament Management", "Revenue Tracking", "Maintenance Scheduling", "Loyalty Program", "Analytics"],
    demoUrl: "https://arcadia-core-os.lovable.app",
    iconName: "Zap",
    color: "from-yellow-500 to-orange-600",
    branding: "Powered by Software Vala™",
    description: "Complete gaming arcade and entertainment center management OS with game machine inventory, player accounts, token/credit system, tournament management, revenue tracking, maintenance scheduling, and customer loyalty programs",
    tech: ["SQLite", "Offline-First", "POS-Integration", "Entertainment-Optimized"]
  },
  {
    name: "Bandora™ — Live Band OS",
    slug: "bandora",
    category: "Live Band / Artist Booking & Tour Management",
    masterCategory: "Music & Entertainment",
    type: "Offline APK",
    modules: ["Gig Booking", "Tour Management", "Fan Engagement", "Revenue Tracking", "Equipment Management", "Performance Scheduling", "Streaming Integration", "Analytics"],
    demoUrl: "https://bandora-stage-hand.lovable.app",
    iconName: "Mic",
    color: "from-red-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Complete live band and artist management OS with gig booking system, tour management, fan engagement, revenue tracking, equipment management, performance scheduling, and streaming integration",
    tech: ["SQLite", "Offline-First", "Event-Calendar", "Music-Optimized"]
  },
  {
    name: "Physiotherapy Center Management System",
    slug: "physiotherapy-clinic",
    category: "Physiotherapy / Rehabilitation Clinic Management",
    masterCategory: "Healthcare",
    type: "Offline APK",
    modules: ["Patient Management", "Treatment Plans & Sessions", "Progress Tracking", "Therapist Scheduling", "Billing & Insurance", "Equipment Inventory", "Assessment Reports", "Analytics"],
    demoUrl: "https://clinic-mate-offline.lovable.app",
    iconName: "Activity",
    color: "from-emerald-600 to-teal-600",
    branding: "Powered by Software Vala™",
    description: "Complete physiotherapy and rehabilitation clinic management system with patient records, treatment planning, session scheduling, progress tracking, therapist management, equipment inventory, insurance billing, and analytics. Reference: WebPT Clinic Management. Offline-first architecture for reliable clinic operations",
    reference: "WebPT Clinic Management",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Offline-First"]
  },
  {
    name: "Camping Organizer System",
    slug: "camping-organizer",
    category: "Camping / Campground Management",
    masterCategory: "Travel & Hospitality",
    type: "Offline APK",
    modules: ["Reservation Management", "Campsite Inventory", "Guest Check-in", "Equipment Rental", "Billing System", "Occupancy Tracking", "Maintenance Scheduling", "Analytics"],
    demoUrl: "https://nature-lodge-app.lovable.app",
    iconName: "Tent",
    color: "from-amber-700 to-green-600",
    branding: "Powered by Software Vala™",
    description: "Complete campground and outdoor facility management system with reservation handling, campsite inventory, guest check-in, equipment rental tracking, billing system, occupancy management, maintenance scheduling, and analytics. Reference: CampManager Reservation System. Offline-first for reliable operations in remote locations",
    reference: "CampManager Reservation System",
    tech: ["React", "TypeScript", "Node.js", "SQLite", "Offline-First"]
  },
  {
    name: "Shortixa™ — Short Film OS",
    slug: "shortixa",
    category: "Short Film / Studio Management",
    masterCategory: "Entertainment",
    type: "Offline APK",
    modules: ["Project Management", "Scene Planning", "Storyboard Creator", "Cast & Crew Scheduling", "Location Scouting", "Budget Tracking", "Equipment Inventory", "Post-Production Workflow"],
    demoUrl: "https://project-39431d.lovable.app",
    iconName: "Film",
    color: "from-purple-900 to-indigo-600",
    branding: "Powered by Software Vala™",
    description: "Complete short film production and studio management OS with project planning, scene management, storyboard creation, cast and crew scheduling, location scouting, budget tracking, equipment inventory, and post-production workflow. Comprehensive solution for independent filmmakers and production studios",
    tech: ["React", "TypeScript", "Node.js", "MongoDB", "Canvas-API", "Offline-First"]
  },
  {
    name: "Honk",
    slug: "honk",
    category: "Towing / Roadside Assistance",
    masterCategory: "Automotive & Transportation",
    type: "Mobile App",
    modules: ["Dispatch Management", "Driver Tracking", "Job Assignment", "Real-time Notifications", "Customer Communication", "Vehicle Database", "Payment Processing", "Analytics"],
    demoUrl: "https://honk-tow-tracker.lovable.app",
    iconName: "AlertTriangle",
    color: "from-red-600 to-yellow-500",
    branding: "Powered by Software Vala™",
    description: "Mobile app for towing and roadside assistance services with dispatch management, real-time driver tracking, job assignment, customer communication, vehicle database, payment processing, and comprehensive analytics. Complete solution for towing companies and roadside service providers",
    tech: ["React Native", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Map-API"]
  },
  {
    name: "RedBus Operator",
    slug: "redbus-operator",
    category: "Private Bus / Bus Operator Management",
    masterCategory: "Public Transport",
    type: "Operator Panel",
    modules: ["Seat Inventory", "Booking Management", "Passenger Communication", "Route Scheduling", "Driver Assignment", "Revenue Tracking", "Fleet Maintenance", "Analytics"],
    demoUrl: "https://bus-seat-manager.lovable.app",
    iconName: "Bus",
    color: "from-orange-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive bus operator management panel with seat inventory, booking management, passenger communication, route scheduling, driver assignment, revenue tracking, fleet maintenance, and detailed analytics. Complete solution for private bus operators and transport companies",
    tech: ["React", "TypeScript", "Node.js", "MySQL", "WebSocket", "Real-time-API"]
  },
  {
    name: "GoMechanic",
    slug: "gomechanic",
    category: "Roadside Assistance / Auto Service",
    masterCategory: "Automotive & Transportation",
    type: "Mobile App",
    modules: ["Service Booking", "Mechanic Network", "Real-time Tracking", "Vehicle Diagnostics", "Service History", "Payment Integration", "Customer Ratings", "Emergency Support"],
    demoUrl: "https://assist-yellow-dark.lovable.app",
    iconName: "Wrench",
    color: "from-yellow-500 to-amber-600",
    branding: "Powered by Software Vala™",
    description: "Mobile app for roadside assistance and auto service booking with mechanic network, service request management, vehicle diagnostics, real-time tracking, payment integration, service history, and customer ratings. Comprehensive platform connecting vehicle owners with certified mechanics",
    tech: ["React Native", "TypeScript", "Node.js", "MongoDB", "Firebase", "Map-API"]
  },
  {
    name: "General Clinic Management System",
    slug: "general-clinic",
    category: "General Clinic / Healthcare Management",
    masterCategory: "Healthcare",
    type: "Offline Android APK",
    modules: ["Patient Records", "Appointment Scheduling", "Doctor Dashboard", "Prescription Management", "Billing System", "Lab Integration", "Inventory Tracking", "Analytics"],
    demoUrl: "https://doctor-desk-go.lovable.app",
    iconName: "Stethoscope",
    color: "from-green-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive general clinic management system with patient records, appointment scheduling, prescription management, doctor dashboard, billing system, lab integration, inventory tracking, and analytics. Reference: Practo Ray Clinic Management. Offline-first APK for reliable clinic operations",
    reference: "Practo Ray Clinic Management",
    tech: ["React", "TypeScript", "Node.js", "SQLite", "Offline-First", "Android-APK"]
  },
  {
    name: "Blade",
    slug: "blade",
    category: "Helicopter Charter / Flight Booking",
    masterCategory: "Travel",
    type: "Mobile App",
    modules: ["Aircraft Availability", "Flight Booking", "Real-time Tracking", "Seat Selection", "Payment Processing", "Flight History", "Customer Ratings", "Flight Management"],
    demoUrl: "https://sky-chic-booking.lovable.app",
    iconName: "Plane",
    color: "from-blue-600 to-cyan-500",
    branding: "Powered by Software Vala™",
    description: "Mobile app for helicopter charter and flight booking with aircraft availability, real-time flight tracking, seat selection, payment processing, flight history, customer ratings, and comprehensive booking management. Premium aviation platform for on-demand helicopter services",
    tech: ["React Native", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Map-API"]
  },
  {
    name: "MyBusTrack",
    slug: "mybustrack",
    category: "School Transport / Bus Tracking",
    masterCategory: "Transportation & Logistics",
    type: "Mobile App",
    modules: ["Real-time Bus Tracking", "Student Attendance", "Route Management", "Parent Notifications", "Driver Assignment", "GPS Location Monitoring", "Emergency Alerts", "Trip History & Reports"],
    demoUrl: "https://mybustrack-pixelperfect.lovable.app",
    iconName: "Bus",
    color: "from-emerald-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Mobile app for real-time school bus tracking with student attendance, route management, parent notifications, driver assignment, GPS monitoring, emergency alerts, and comprehensive trip history. Ensures student safety with real-time location updates and instant communication features",
    tech: ["React Native", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Map-API"]
  },
  {
    name: "ADVERTIXA™ — ADVERTISING OS",
    slug: "advertixa",
    category: "Advertising Agency Management",
    masterCategory: "Marketing & Advertising",
    type: "Management Software / Offline APK",
    modules: ["Campaign Management", "Client Management", "Creative Asset Library", "Budget & Cost Tracking", "Performance Analytics", "Team Collaboration", "Invoice & Billing", "Project Timeline & Delivery"],
    demoUrl: "https://advertixa-master-os.lovable.app",
    iconName: "Megaphone",
    color: "from-purple-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive advertising agency management software with campaign management, client management, creative asset library, budget tracking, performance analytics, team collaboration, invoice management, and project timeline delivery. Enterprise solution for advertising agencies and marketing firms",
    reference: "MASTER 19",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "SQLite", "Offline-First"]
  },
  {
    name: "SPACE TECHNOLOGY STARTUP MANAGEMENT SYSTEM",
    slug: "space-tech",
    category: "Space Technology / Aerospace Management",
    masterCategory: "Technology & Aerospace",
    type: "Management Software / Offline APK",
    modules: ["Mission Control", "Launch Scheduling", "Payload Tracking", "Telemetry Monitoring", "Team Coordination", "Resource Allocation", "Risk Assessment", "Project Documentation"],
    demoUrl: "https://stellar-vault-ops.lovable.app",
    iconName: "Rocket",
    color: "from-indigo-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive space technology and aerospace management system with mission control, launch scheduling, payload tracking, telemetry monitoring, team coordination, resource allocation, risk assessment, and project documentation. Enterprise solution for space startups and aerospace organizations",
    reference: "NO 7",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "SQLite", "Offline-First"]
  },
  {
    name: "BPCL SmartDrive",
    slug: "bpcl-smartdrive",
    category: "Gas Station / Fuel & Loyalty",
    masterCategory: "Retail & Fuel",
    type: "Mobile App / Customer App",
    modules: ["Fuel Price Tracking", "Loyalty Rewards Program", "Cashback Management", "Station Locator & GPS", "Transaction History", "Payment Gateway", "Discount Coupons", "Membership Benefits"],
    demoUrl: "https://smartdrive-clone-ui.lovable.app",
    iconName: "Fuel",
    color: "from-orange-600 to-yellow-500",
    branding: "Powered by Software Vala™",
    description: "Mobile customer app for BPCL gas stations with fuel price tracking, loyalty rewards, cashback programs, fuel station locator with GPS, transaction history, payment management, discount coupons, and membership benefits. Seamless fueling experience with integrated loyalty ecosystem",
    reference: "32",
    tech: ["React Native", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Map-API"]
  },
  {
    name: "MARKETIXA™ — DIGITAL MARKETING OS",
    slug: "marketixa",
    category: "Digital Marketing Agency Management",
    masterCategory: "Marketing & Advertising",
    type: "Management Software / Offline APK",
    modules: ["Campaign Management", "Social Media Scheduling", "Content Calendar", "Performance Analytics", "Lead Tracking", "Customer Journey Mapping", "Budget Management", "Multi-Channel Automation"],
    demoUrl: "https://marketixa-os.lovable.app",
    iconName: "Zap",
    color: "from-cyan-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive digital marketing management platform with campaign management, social media scheduling, content calendar, performance analytics, lead tracking, customer journey mapping, budget management, and multi-channel marketing automation. Enterprise solution for digital marketing agencies",
    reference: "MASTER 19",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "SQLite", "Offline-First"]
  },
  {
    name: "Snowman Logistics",
    slug: "snowman-logistics",
    category: "Cold Chain / Logistics Management",
    masterCategory: "Logistics",
    type: "Web Dashboard / Admin Panel",
    modules: ["Temperature Monitoring", "Shipment Tracking", "Cold Storage Management", "Route Optimization", "Compliance Reporting", "Inventory Management", "Alert & Notifications", "Analytics & Reporting"],
    demoUrl: "https://snowman-logistics-ui.lovable.app",
    iconName: "Snowflake",
    color: "from-blue-600 to-cyan-500",
    branding: "Powered by Software Vala™",
    description: "Professional web dashboard for cold chain logistics management with real-time temperature monitoring, shipment tracking, cold storage warehouse management, delivery route optimization, compliance reporting, and inventory management. Enterprise solution for cold chain operators and pharmaceutical logistics",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Real-time API"]
  },
  {
    name: "DHL Logistics",
    slug: "dhl-logistics",
    category: "Logistics & Transportation Software / International Cargo",
    masterCategory: "Logistics",
    type: "Web-based Enterprise Logistics Software",
    modules: ["Shipment Creation", "Address Management", "International Tracking", "Status Timeline", "Document Management", "Payment Processing", "Shipment History", "Customer Support"],
    demoUrl: "https://pixel-parade-ship.lovable.app",
    iconName: "Truck",
    color: "from-yellow-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Enterprise global shipment management platform with international cargo creation, address book management, real-time tracking, status timeline updates, comprehensive documentation, secure payment processing, shipment history, and dedicated customer support. Industry-leading solution for international logistics and courier operations worldwide",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Global Shipping API"]
  },
  {
    name: "Trekking Organizer System",
    slug: "trekking-organizer",
    category: "Travel & Tourism Management Software / Trekking",
    masterCategory: "Travel",
    type: "Native Android APK, Offline-First",
    modules: ["Trek Management", "Booking Management", "Participant Tracking", "Guide Assignment", "Equipment Management", "Payment Processing", "Offline Storage", "Reports & Analytics"],
    demoUrl: "https://trekwise-organizer.lovable.app",
    iconName: "Tent",
    color: "from-green-600 to-emerald-500",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first trek and adventure tour management system for organizers, guides, and adventure companies. Features complete trek/booking/participant management, guide assignment, equipment tracking, offline database storage with SQLite, key-based activation, and secure payment processing. Designed for adventure tour operators managing complex multi-day treks with participants, equipment, and guide coordination",
    reference: "TourCMS Adventure Tour Management",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "GarageWorks",
    slug: "garageworks",
    category: "Automotive Service Management Software / Bike Repair",
    masterCategory: "Retail & Services",
    type: "Web / Mobile Service Booking UI",
    modules: ["Bike Selection", "Issue Tracking", "Service Booking", "Slot Management", "Technician Tracking", "In-App Chat", "Invoice Generation", "Customer Profiles"],
    demoUrl: "https://garage-wheelies-app.lovable.app",
    iconName: "Wrench",
    color: "from-orange-600 to-amber-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive bike repair and home service management platform for service providers and customers. Features bike selection, issue tracking, service booking, slot management, real-time technician tracking, in-app chat support, invoice generation, and customer profiles. Designed for bike repair shops, automotive service centers, and on-demand home service businesses managing multiple technicians and service requests",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Mobile API"]
  },
  {
    name: "AI Research Lab Management System",
    slug: "ai-research-lab",
    category: "AI / Research Management",
    masterCategory: "Research & Analytics",
    type: "Offline Android APK",
    modules: ["AI Project Management", "Dataset Management", "Model Training Tracking", "Experiment Logging", "Research Reports", "Audit Trails", "Version Control", "Offline Storage"],
    demoUrl: "https://secure-lab-opus.lovable.app",
    iconName: "Bot",
    color: "from-purple-600 to-indigo-600",
    branding: "Powered by Software Vala™",
    description: "Advanced AI research lab management platform for AI projects, datasets, models, and experiment tracking. Features comprehensive project management, dataset versioning, ML model training tracking, experiment logging with detailed reports, audit trails, license key-based activation, and device-bound local database storage. Designed for research teams, data scientists, and AI labs managing complex machine learning workflows offline",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "AI Salon & Spa Management System",
    slug: "ai-salon-spa",
    category: "Salon & Spa Management SaaS",
    masterCategory: "Beauty & Wellness",
    type: "Cloud-Based Multi-Tenant SaaS",
    modules: ["Appointment Booking", "AI Staff Scheduling", "POS Integration", "Inventory Management", "CRM System", "Demand Forecasting", "Upsell Recommendations", "Customer Analytics"],
    demoUrl: "https://glowflow-system.lovable.app",
    iconName: "Sparkles",
    color: "from-pink-600 to-rose-600",
    branding: "Powered by Software Vala™",
    description: "Enterprise cloud-based AI-powered salon and spa management platform with appointment booking, staff scheduling, POS integration, inventory management, CRM, customer portal, and advanced AI automation. Features AI-driven scheduling optimization, demand forecasting, intelligent upselling recommendations, churn prediction, and personalized customer recommendations. Multi-tenant SaaS with RBAC, audit logs, encryption, and multi-location isolation for salon chains and spa networks",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Cloud API"]
  },
  {
    name: "DiamondCoaching",
    slug: "diamondcoaching",
    category: "Education / Coaching Management / Law Coaching Institute",
    masterCategory: "Education",
    type: "Web-Based Coaching SaaS",
    modules: ["Course Management", "Live Class Scheduling", "Student Tracking", "Faculty Management", "Case Law Library", "Exam Management", "Mentorship Programs", "Performance Analytics"],
    demoUrl: "https://diamond-law-nexus.lovable.app",
    iconName: "Briefcase",
    color: "from-blue-900 to-amber-700",
    branding: "Powered by Software Vala™",
    description: "Premium law coaching institute management platform with comprehensive course management, live class scheduling, student performance tracking, faculty coordination, case law library, exam management, and mentorship programs. Features AI-powered weak topic detection for students, risk prediction for exam performance, intelligent course recommendations, and mentor matching. Enterprise SaaS with role-based access control, JWT authentication, OTP security, audit logs, and glassmorphism design with luxury dark legal theme",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Legal API"]
  },
  {
    name: "PRONIXA™ — PR Agency OS",
    slug: "pronixa",
    category: "Public Relations Management",
    masterCategory: "Retail & Services",
    type: "Offline Android APK",
    modules: ["PR Campaign Management", "Media Relations", "Brand Communication", "Press Release Distribution", "Media Monitoring", "Client Management", "Performance Reporting", "Offline Operations"],
    demoUrl: "https://irctc-mirror-app.lovable.app",
    iconName: "Megaphone",
    color: "from-slate-600 to-purple-600",
    branding: "Powered by Software Vala™",
    description: "Enterprise offline-first PR agency management platform for comprehensive public relations operations, media relations, and brand communication management. Features complete PR campaign management, media database and contact management, brand communication tracking, press release distribution, media monitoring, client management, and performance reporting. Secure key-based activation with device-bound local storage for offline operations. Designed for PR agencies, communications teams, and brand management professionals",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "PRINTIXA™ — Printing & Media OS",
    slug: "printixa",
    category: "Printing & Media Management",
    masterCategory: "Retail & Services",
    type: "Offline Android APK",
    modules: ["Order Management", "Production Scheduling", "Client Database", "Inventory Tracking", "Delivery Operations", "Financial Management", "Reports & Analytics", "Audit Trails"],
    demoUrl: "https://printixa-guardian-system.lovable.app",
    iconName: "Package",
    color: "from-orange-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first printing and media production management platform for handling print orders, media production workflows, client management, inventory tracking, and delivery operations. Features complete order management with production scheduling, client database and communication, real-time inventory tracking with alerts, delivery management and logistics, comprehensive financial tracking with invoicing, detailed reports and analytics, and complete audit trails. Secure key-first activation with device-bound encrypted local database for maximum data protection. Ideal for printing companies, media production houses, and print service providers",
    tech: ["React Native", "TypeScript", "SQLite", "Encrypted DB", "Android APK", "Device-Bound"]
  },
  {
    name: "3M Car Care",
    slug: "3m-car-care",
    category: "Automotive Service Management",
    masterCategory: "Retail & Services",
    type: "Web/Mobile Service Booking UI",
    modules: ["Services & Packages", "Booking Management", "Slot Management", "Service Center Directory", "Order Tracking", "Photo Gallery", "Reviews & Ratings", "Customer Profiles"],
    demoUrl: "https://shiny-wash-ui.lovable.app",
    iconName: "Sparkles",
    color: "from-blue-600 to-cyan-600",
    branding: "Powered by Software Vala™",
    description: "Premium car wash and automotive service management platform featuring comprehensive service booking, package selection, and order tracking. Complete car wash services with multiple packages, real-time slot availability, service center location management, and professional order tracking. Includes photo gallery showcasing service results, customer reviews and ratings system, and complete customer profile management. Premium glossy interface with clean typography and responsive design for both web and mobile customers. Built for car wash facilities, automotive service centers, and professional detailing businesses",
    tech: ["React", "TypeScript", "Node.js", "Firebase", "Mobile API", "Responsive UI"]
  },
  {
    name: "Immortal Healing Coach",
    slug: "immortal-healing-coach",
    category: "Wellness & Coaching",
    masterCategory: "Healthcare",
    type: "Android APK",
    modules: ["Healing Library", "Coaching Programs", "Live Sessions", "Chat Support", "AI Mood Recommendations", "Progress Tracking", "Payment Processing", "Admin Dashboard"],
    demoUrl: "https://soul-soothe-sessions-50.lovable.app",
    iconName: "Heart",
    color: "from-purple-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive spiritual healing and mindset coaching platform for guided wellness sessions, personalized healing programs, and transformative coaching. Features extensive healing library with curated content, structured coaching programs, live sessions with experienced coaches, and real-time chat support. AI-powered mood recommendations providing personalized affirmations and healing suggestions based on user emotional state. Complete profile management with progress tracking, secure payment processing for premium programs and sessions, admin dashboard for coaches, and role-based access control. OTP-based login with device binding ensures data security. Designed for wellness practitioners, spiritual coaches, and healing professionals",
    tech: ["React Native", "TypeScript", "Firebase", "Cloud Functions", "RBAC", "OTP Security"]
  },
  {
    name: "WareIQ",
    slug: "wareiq",
    category: "Warehouse Management",
    masterCategory: "Logistics",
    type: "Web / Warehouse Management UI",
    modules: ["Inventory Management", "Inbound Operations", "Outbound Operations", "Order Management", "Stock Tracking", "Reports & Analytics", "Status Alerts", "Real-time Monitoring"],
    demoUrl: "https://lovly-wareiq-clone.lovable.app",
    iconName: "Boxes",
    color: "from-slate-700 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive warehouse management platform for efficient inventory control, inbound and outbound operations, order management, and real-time stock tracking. Features complete inventory management with granular tracking, streamlined inbound receiving and outbound shipping operations, integrated order management system, real-time stock level monitoring, comprehensive reporting and analytics, and instant alerts for critical inventory events. Clean grid-based and table-driven interface with intuitive status tags for quick operational visibility. Built for warehouse operators, logistics managers, and supply chain professionals seeking operational efficiency and data-driven insights",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Firebase", "Data Tables"]
  },
  {
    name: "Synapz Cloud",
    slug: "synapz-cloud",
    category: "AI Collaboration & Project Management",
    masterCategory: "ERP",
    type: "Cloud-Based SaaS",
    modules: ["Project Management", "Task Management", "Sprint Planning", "Team Collaboration", "AI Auto Assignment", "Deadline Prediction", "Burnout Detection", "Risk Forecasting"],
    demoUrl: "https://synapz-ai-nexus.lovable.app",
    iconName: "Zap",
    color: "from-indigo-700 to-slate-900",
    branding: "Powered by Software Vala™",
    description: "Advanced AI-powered project and team collaboration platform featuring intelligent automation, predictive analytics, and comprehensive resource management. Comprehensive project and task management with sprint planning and workflow automation, complete team collaboration tools with role-based permissions and project-level access control. AI-powered features including automatic task assignment, intelligent deadline prediction, burnout detection for team wellness, and performance/risk forecasting. Integrated billing and time tracking, CRM module for client management, file storage and sharing, virtual meeting capabilities, and secure encrypted storage. Futuristic dark elite interface with full-screen workspace and no sidebar constraints for maximum productivity. Enterprise cloud-based SaaS designed for development teams, agile squads, and collaborative organizations",
    tech: ["React", "TypeScript", "Node.js", "PostgreSQL", "Cloud Infrastructure", "AI/ML"]
  },
  {
    name: "ARTIXA™ — Artist Booking OS",
    slug: "artixa",
    category: "Artist & Entertainment Management",
    masterCategory: "Entertainment",
    type: "Offline Android APK",
    modules: ["Artist Profiles", "Booking Management", "Schedule Planning", "Performance Tracking", "Client Management", "Payment Processing", "Communication", "Offline Operations"],
    demoUrl: "https://artixia-gig-hub.lovable.app",
    iconName: "Music",
    color: "from-purple-600 to-red-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first artist booking and performance management platform for entertainment industry professionals. Complete artist portfolio management with detailed profiles and performance history, streamlined booking request handling and confirmation workflows, intelligent scheduling system with conflict detection and optimization, comprehensive performance management with scheduling and event tracking. Complete client management with communication history and preferences, secure payment processing and invoicing, offline-first architecture with device binding for secure operations. Key-first activation with encrypted local database ensures data security and privacy. Designed for booking agents, entertainment managers, event organizers, and artist management companies",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "Cricket Academy Management",
    slug: "cricket-academy",
    category: "Sports Academy Management",
    masterCategory: "Sports & Recreation",
    type: "Offline Android APK",
    modules: ["Player Management", "Batch Scheduling", "Coach Management", "Training Tracking", "Match Management", "Attendance Tracking", "Fee Management", "Performance Analytics"],
    demoUrl: "https://boundary-line-buddy.lovable.app",
    iconName: "Activity",
    color: "from-blue-900 to-orange-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first cricket academy management platform designed for training centers, coaching facilities, and sports academies. Complete player management with detailed profiles, skill assessments, and performance tracking. Comprehensive batch and class scheduling with coach assignments and curriculum management. Advanced training session tracking with practice logs and skill development monitoring. Complete match management with team assignments, schedules, and performance statistics. Automated attendance tracking for players and coaches with insightful reports. Integrated fee management with invoicing, payment tracking, and financial reporting. Performance analytics with player statistics, improvement trends, and predictive insights. Touch-friendly interface with navy blue and orange branding for sports environment. Secure license key activation with device binding and encrypted local SQLite database",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "Swimming Academy Management",
    slug: "swimming-academy",
    category: "Sports Academy Management",
    masterCategory: "Sports & Recreation",
    type: "Offline Android APK",
    modules: ["Swimmer Profiles", "Batch Scheduling", "Coach Management", "Lane Management", "Training Tracking", "Attendance Tracking", "Fee Management", "Performance Analytics"],
    demoUrl: "https://swim-smart-manager.lovable.app",
    iconName: "Waves",
    color: "from-cyan-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first swimming academy management platform designed for swimming schools, training centers, and aquatic facilities. Complete swimmer profile management with skill levels, certifications, and performance tracking. Advanced batch and lane scheduling with coach assignments and curriculum management for different swimming levels. Comprehensive training session tracking with lap times, technique assessments, and skill development monitoring. Pool and lane management with capacity tracking and optimization. Automated attendance tracking with performance analytics and progress reports. Integrated fee management with invoicing and payment tracking. Complete reporting suite with performance trends, achievement certifications, and progression analytics. Aqua blue and white interface with lane-based visualization perfect for pool management. Secure license key activation with device binding and encrypted local SQLite database",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Device-Bound"]
  },
  {
    name: "Guinea Connect",
    slug: "guinea-connect",
    category: "Super Marketplace",
    masterCategory: "Marketplace & Super Apps",
    type: "Mobile App + Web + Admin Panel",
    modules: ["Services Booking", "Freelance Jobs", "Real Estate Listings", "Delivery Tracking", "Chat & Messaging", "Payment Processing", "Ratings & Reviews", "Multi-Role Management"],
    demoUrl: "https://market-maestro-gn.lovable.app",
    iconName: "Globe",
    color: "from-orange-600 to-amber-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive super marketplace platform designed for local services, jobs, real estate, and delivery across Guinea. Multi-vendor ecosystem connecting service providers, freelancers, real estate agents, and delivery drivers with customers. Complete booking system for local services with instant confirmation and scheduling. Advanced freelance job marketplace with skill-based matching and secure payments. Comprehensive real estate listings with property details, virtual tours, and agent connections. Integrated delivery management with real-time tracking and multiple provider options. Built-in messaging system for seamless communication between all user roles. Secure payment gateway with multiple currency support including Guinean Franc (GNF). Admin panel for marketplace management, vendor verification, and dispute resolution. French and English localization for West African markets. Modern African-inspired UI with zero-confusion navigation perfect for emerging markets. Support for multiple roles: Admin, Customer, Vendor, Provider, Driver, Agent, Freelancer. Complete rating and review system for trust and transparency across all services",
    tech: ["React Native", "React", "TypeScript", "Node.js", "Real-time", "Marketplace Engine"]
  },
  {
    name: "Maruti Driving School",
    slug: "maruti-driving-school",
    category: "Driving School Management",
    masterCategory: "Education",
    type: "Web / Mobile Learning UI",
    modules: ["Student Enrollment", "Course Management", "Trainer Scheduling", "Video Learning", "Progress Tracking", "Test Management", "Certificate Generation", "Student Profiles"],
    demoUrl: "https://drive-bright-school.lovable.app",
    iconName: "Gauge",
    color: "from-orange-600 to-amber-500",
    branding: "Powered by Software Vala™",
    description: "Comprehensive driving school management platform designed for training centers, driving institutions, and educational organizations. Complete student enrollment system with profile management, progress tracking, and certification records. Advanced course and class scheduling with trainer assignments and curriculum management for different driving levels and vehicle types. Integrated video learning platform with instructional content, safety guidelines, and best practices. Comprehensive progress tracking with performance metrics, skill assessments, and learner statistics. Professional trainer management with availability scheduling and performance ratings. Automated test management with multiple choice assessments, practical evaluations, and result tracking. Digital certificate generation with verification capabilities and secure distribution. Student profile system with learning history, achievements, and progress reports. Interactive dashboard for students, trainers, and administrators. Orange and white educational interface with clean, intuitive navigation perfect for learning platforms. Secure login with role-based access control for different user types",
    tech: ["React", "TypeScript", "Node.js", "Video Hosting", "Assessment Engine"]
  },
  {
    name: "TICKORA™ — Ticket Booking OS",
    slug: "tickora",
    category: "Ticket Booking & Event Management",
    masterCategory: "Event Management",
    type: "Offline Android APK",
    modules: ["Event Management", "Ticket Booking", "QR Entry", "Customer Profiles", "Seat Management", "Finance Tracking", "Reports", "Audit Logs"],
    demoUrl: "https://lock-and-key-events.lovable.app",
    iconName: "Ticket",
    color: "from-purple-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first ticket booking and event management platform designed for event organizers, venues, theaters, concert halls, and sporting events. Complete event creation and management with detailed descriptions, dates, pricing tiers, and capacity management. Advanced ticket booking system with seat selection, inventory management, and real-time availability. QR code generation and verification for seamless entry management at event venues. Integrated customer management with booking history, preferences, and loyalty tracking. Professional reporting suite with sales analytics, occupancy rates, revenue tracking, and audit trails. Complete financial management with invoice generation, payment tracking, and settlement reporting. Offline-first architecture with encrypted local SQLite database ensuring operation without internet connectivity. Secure license key activation with device binding for installation-based deployment. Role-based access control for event managers, operators, support staff, and administrators. Purple and pink themed interface with intuitive navigation perfect for event management. Comprehensive audit logging for compliance and security",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "QR Code"]
  },
  {
    name: "Pet Grooming, Booking & Care Center Software",
    slug: "pet-grooming-care",
    category: "Pet Care & Grooming Management",
    masterCategory: "Pet Care & Services",
    type: "SaaS Web + Mobile",
    modules: ["Pet Profiles", "Grooming Bookings", "Service Management", "AI Scheduling", "Staff Management", "Inventory Tracking", "Payment Processing", "Health Alerts"],
    demoUrl: "https://pawsome-ai-dash.lovable.app",
    iconName: "PawPrint",
    color: "from-teal-600 to-cyan-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive AI-powered pet grooming and care center management platform designed for grooming salons, pet care facilities, and veterinary clinics. Complete pet profile management with medical history, vaccinations, allergies, and behavioral notes. Advanced booking system with service scheduling, staff assignments, and availability management. Professional grooming service catalog with customizable packages, pricing tiers, and duration estimates. AI-driven grooming suggestions based on pet breed, coat type, and previous services. Intelligent scheduling optimization to maximize staff efficiency and reduce wait times. Integrated inventory management for grooming supplies, treatments, and retail products. Staff management with performance tracking, certification management, and skill-based assignment. Secure payment processing with multiple payment methods and automated invoicing. Customer management with pet ownership tracking, preference history, and loyalty programs. AI health alerts for vaccination reminders, grooming frequency recommendations, and health anomalies. Integrated chatbot for customer inquiries, appointment reminders, and service recommendations. Comprehensive reporting with financial analytics, utilization metrics, and customer satisfaction. Glassmorphism UI design with teal and mint color scheme for modern, pet-friendly aesthetics. Multi-role access for Super Admin, Center Admin, Groomer, Customer, and Vet collaboration",
    tech: ["React", "TypeScript", "Node.js", "AI Engine", "Real-time", "SaaS Architecture"]
  },
  {
    name: "EVANTIX™ — Event Management OS",
    slug: "evantix",
    category: "Entertainment, Media & Event Management",
    masterCategory: "Entertainment & Media",
    type: "Offline Android APK",
    modules: ["Event Planning", "Booking System", "Ticketing", "Vendor Management", "Artist Coordination", "Equipment Management", "Production Planning", "Finance Tracking"],
    demoUrl: "https://event-guard-key.lovable.app",
    iconName: "Music",
    color: "from-red-600 to-amber-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first event management platform designed for event organizers, entertainment venues, concert halls, studios, and production companies. Complete event creation and planning with detailed descriptions, dates, budgets, and comprehensive timeline management. Advanced booking system for venues, equipment, and talent with real-time availability and conflict detection. Professional ticketing system with multiple pricing tiers, promotional codes, and seat selection. Vendor management system for coordinating services, supplies, equipment rentals, and catering. Artist and talent management with profiles, availability, contracts, and performance schedules. Equipment and studio booking with inventory tracking, maintenance scheduling, and asset management. Production planning tools with crew coordination, technical requirements, and production schedules. Marketing module with promotional campaigns, social media integration, and event promotion tools. Complete financial management with budgeting, expense tracking, revenue reporting, and settlement processing. Offline-first architecture with encrypted local SQLite database for operation without internet connectivity. Secure license key activation with device binding for installation-based deployment. Role-based access for event managers, producers, coordinators, vendors, and administrators. Comprehensive audit logging and compliance reporting. Red and gold themed interface perfect for entertainment and media industry.",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "Production Engine"]
  },
  {
    name: "CarDekho Inspect",
    slug: "cardekho-inspect",
    category: "Vehicle Inspection Management",
    masterCategory: "Automotive & Transportation",
    type: "Web / Mobile Inspection UI",
    modules: ["Dashboard", "Booking Management", "Vehicle Details", "Inspection Checklist", "Photo Documentation", "Report Generation", "Status Tracking", "Inspector Profiles"],
    demoUrl: "https://inspect-car-pixelfit.lovable.app",
    iconName: "Car",
    color: "from-blue-600 to-slate-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive vehicle inspection management platform designed for car dealers, inspection centers, automotive service providers, and logistics companies. Complete dashboard with real-time inspection status, booking management, and vehicle tracking. Advanced booking system for scheduling vehicle inspections with time slot management and inspector assignments. Detailed vehicle information capture including make, model, year, mileage, registration details, and ownership history. Interactive checklist with comprehensive vehicle inspection points covering exterior, interior, mechanical, and electrical systems. Photo documentation with multimedia capture, image tagging, annotation tools, and organized media galleries. Automated report generation with professional inspection summaries, findings documentation, and historical records. Real-time status tracking for inspections in progress, completed, and pending reviews. Customer and inspector profiles with performance metrics, rating systems, and verification details. Mobile-responsive inspection UI optimized for fieldwork with offline capability. Real-time data sync when connectivity available. Integration with photo storage and document management systems. Professional report layouts with customizable templates. Role-based access for inspectors, supervisors, and administrators. Comprehensive audit trail and inspection history. Blue and slate professional theme perfect for automotive industry.",
    tech: ["React", "TypeScript", "Node.js", "Photo Storage", "Report Engine", "Mobile-First"]
  },
  {
    name: "JetSetGo",
    slug: "jetsetgo",
    category: "Aviation & Travel",
    masterCategory: "Travel & Tourism",
    type: "Web / Mobile Charter UI",
    modules: ["Aircraft Search", "Charter Request", "Quote Management", "Booking System", "Trip Dashboard", "Invoice Generation", "Trip History", "Customer Profiles"],
    demoUrl: "https://jetset-lux-ui.lovable.app",
    iconName: "Plane",
    color: "from-amber-600 to-black",
    branding: "Powered by Software Vala™",
    description: "Comprehensive private jet charter and aviation booking platform designed for luxury travel providers, charter operators, and aviation companies. Advanced search engine with intelligent aircraft filtering by size, range, amenities, and pricing. Detailed aircraft catalog with professional photography, specifications, performance metrics, and amenity listings. Complete charter request system with flexible date/time selection, passenger count, departure/arrival preferences. Automated quote generation with transparent pricing, fuel surcharges, taxes, and service fees. Professional booking system with instant confirmation, payment processing, and secure contracts. Trip management dashboard with real-time flight status, crew coordination, and passenger communication. Comprehensive invoice generation with itemized services, payment terms, and compliance documentation. Customer trip history with previous bookings, preferences, and customized flight details. Luxury white interface with gold and black accents for premium aesthetic. High-quality image galleries showcasing aircraft and amenities. Professional card layouts with large imagery and detailed descriptions. Role-based access for operators, flight coordinators, customers, and administrators. Comprehensive audit trail and compliance reporting. Perfect for luxury travel experiences and charter operations.",
    tech: ["React", "TypeScript", "Node.js", "Payment Gateway", "Search Engine", "Premium UI"]
  },
  {
    name: "CULTORA™ — Cultural Event OS",
    slug: "cultora",
    category: "Cultural Event Management",
    masterCategory: "Cultural & Arts",
    type: "Offline Android APK",
    modules: ["Event Management", "Program Planning", "Artist Coordination", "Booking System", "Operational Management", "Finance Tracking", "Attendee Management", "Reporting & Analytics"],
    demoUrl: "https://cultura-event-hub.lovable.app",
    iconName: "Music",
    color: "from-violet-600 to-pink-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive offline-first cultural event management platform designed for cultural organizations, event producers, artists, and arts institutions. Complete event creation and management with detailed descriptions, dates, venues, and artistic direction. Advanced program planning with performance scheduling, artist coordination, and artistic requirements. Professional artist management with profiles, performance history, contracts, and compensation tracking. Integrated booking system for event tickets, artist appearances, and venue reservations with capacity management. Comprehensive operational management with venue setup, technical requirements, crew coordination, and logistics. Complete financial management with budgeting, artist payments, ticket revenue, and expense tracking. Attendee management with registration, ticketing, attendance tracking, and audience analytics. Comprehensive reporting with financial reports, audience demographics, artistic analytics, and performance metrics. Offline-first architecture with encrypted local SQLite database for operation without internet connectivity. Secure license key activation with device binding for installation-based deployment. Role-based access for event managers, artists, venue coordinators, and administrators. Comprehensive audit logging and compliance reporting. Purple and magenta themed interface perfect for cultural and arts industry.",
    tech: ["React Native", "TypeScript", "SQLite", "Offline-First", "Android APK", "License Engine"]
  },
  {
    name: "DeHaat",
    slug: "dehaat",
    category: "AgriTech & Agricultural Transport",
    masterCategory: "Agriculture & Agritech",
    type: "Web / Mobile Agri Services",
    modules: ["Services Marketplace", "Transport Booking", "Orders Management", "Vehicle Tracking", "Agricultural Marketplace", "Payment Processing", "Farmer Profiles", "Inventory Management"],
    demoUrl: "https://earth-ride-portal.lovable.app",
    iconName: "Leaf",
    color: "from-green-600 to-emerald-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive agricultural services and transport platform designed for farmers, agricultural businesses, rural communities, and agritech providers. Advanced services marketplace connecting farmers with agricultural services including equipment rental, crop consulting, and farming support. Professional transport booking system for agricultural goods movement with vehicle tracking and real-time updates. Complete orders management with order placement, fulfillment tracking, and delivery confirmation. Vehicle fleet management with inventory tracking, maintenance scheduling, and utilization analytics. Real-time tracking with GPS integration, driver communication, and delivery status updates. Integrated agricultural marketplace with product listings, pricing, farmer networks, and bulk orders. Payment processing with secure transactions, rural payment methods, and transaction history. Farmer profile management with farming data, crop records, service history, and ratings. Complete financial management with earnings tracking, payment settlements, and transaction records. Mobile-first design optimized for rural connectivity and offline functionality. Integration with agricultural data and farming analytics. Role-based access for farmers, service providers, transport operators, and administrators. Comprehensive reporting with service analytics, marketplace insights, and operational metrics. Green and earthy theme with large icons and simple card layouts perfect for rural accessibility.",
    tech: ["React", "TypeScript", "Node.js", "GPS Tracking", "Marketplace Engine", "Mobile-First"]
  },
  {
    name: "Vahan",
    slug: "vahan",
    category: "RTO Documentation / Vehicle Services",
    masterCategory: "Government Services",
    type: "Docs System",
    modules: ["Vehicle Registration", "Vehicle Information", "Registration Certificates", "Transfer Management", "Tax & Fees", "Status Tracking", "Document Management", "Service Requests"],
    demoUrl: "https://vahan-doc-clone.lovable.app",
    iconName: "Building",
    color: "from-slate-600 to-blue-600",
    branding: "Powered by Software Vala™",
    description: "Comprehensive government RTO (Road Transport Office) vehicle documentation and services platform designed for vehicle registration authorities, transport offices, vehicle owners, and documentation centers. Complete vehicle registration management with RC (Registration Certificate) issuance, digital certificates, and registration tracking. Advanced vehicle information system with detailed vehicle specifications, ownership history, and document storage. Professional registration certificate management with digital RC, transfers, renewals, and validity tracking. Vehicle transfer system with ownership change processing, documentation workflows, and transfer verification. Tax and fee management with vehicle tax calculation, payment tracking, compliance reporting, and deadline management. Real-time status tracking for registrations, transfers, taxes, and document requests. Comprehensive document management with uploads, verification, approval workflows, and archive storage. Service request management with application tracking, status updates, and notification system. Simple government UI with list views, form-based data entry, and clear navigation. Mobile-responsive design for citizen accessibility. Integration with vehicle databases and registration records. Role-based access for RTO officers, vehicle owners, vendors, and administrators. Comprehensive audit logging and compliance reporting. Professional government theme perfect for transportation authorities.",
    tech: ["React", "TypeScript", "Node.js", "Document Engine", "Registration System", "Government UI"]
  },
];

/**
 * MASTER CATEGORY MAPPING
 * Maps exact supplied categories to Homepage master categories
 */
export const CATEGORY_MASTER_MAP: Record<string, string> = {
  "Public Transport": "Public Transport",
  "Retail & POS": "Retail & POS",
  "Education": "Education",
  "Healthcare": "Healthcare",
  "Logistics": "Logistics",
  "Sports & Recreation": "Sports & Recreation",
  "E-commerce": "E-commerce",
  "Travel": "Travel",
  "Research & Analytics": "Research & Analytics",
  "Event Management": "Event Management",
  "Publishing": "Publishing",
  "Event Services": "Event Services",
};

/**
 * ICON MAPPING
 * Maps icon names to lucide-react icons
 */
export const ICON_MAPPING: Record<string, string> = {
  "Bus": "Bus",
  "ShoppingCart": "ShoppingCart",
  "GraduationCap": "GraduationCap",
  "Stethoscope": "Stethoscope",
  "Truck": "Truck",
  "Users": "Users",
  "ShoppingBag": "ShoppingBag",
  "Anchor": "Anchor",
  "Layers": "Layers",
  "BarChart3": "BarChart3",
  "Calendar": "Calendar",
  "FileText": "FileText",
  "Sparkles": "Sparkles",
};

/**
 * Get demo by slug
 */
export function getSuppliedDemoBySlug(slug: string): SuppliedDemo | undefined {
  return SUPPLIED_DEMOS_16.find(d => d.slug === slug);
}

/**
 * Get demo by exact name
 */
export function getSuppliedDemoByName(name: string): SuppliedDemo | undefined {
  return SUPPLIED_DEMOS_16.find(d => d.name === name);
}

/**
 * Get all demos in a category
 */
export function getDemosByMasterCategory(masterCategory: string): SuppliedDemo[] {
  return SUPPLIED_DEMOS_16.filter(d => d.masterCategory === masterCategory);
}

/**
 * Validate demo URL is in allowed list
 */
export function isDemoUrlAllowed(url: string): boolean {
  return SUPPLIED_DEMOS_16.some(d => d.demoUrl === url);
}

/**
 * Get all unique master categories
 */
export function getAllMasterCategories(): string[] {
  return Array.from(new Set(SUPPLIED_DEMOS_16.map(d => d.masterCategory)));
}
