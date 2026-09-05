/**
 * Bootstrap: Auto-initialize 16 supplied demos on server startup
 * Non-destructive: Upserts by slug/product_id, preserves existing data
 * Runs once and silently if already imported or if service key unavailable
 */

import { createClient } from "@supabase/supabase-js";

let bootstrapExecuted = false;

// 16 exact supplied demos with all metadata
const SUPPLIED_DEMOS_BOOTSTRAP = [
  {
    slug: "delhi-metro-app",
    name: "Delhi Metro App",
    category: "Public Transport",
    description: "Metro ticketing system with routes, journey planning, fare calculation, and QR-based smart card integration.",
    icon: "Bus",
    demo_url: "https://delhi-ride-ui.lovable.app",
    color: "from-blue-600 to-cyan-600",
  },
  {
    slug: "retailx-core",
    name: "RetailX Core",
    category: "Retail & POS",
    description: "Offline-first retail POS system with GST invoicing, thermal printing, and inventory management.",
    icon: "ShoppingCart",
    demo_url: "https://retail-heartbeat-92.lovable.app",
    color: "from-purple-600 to-pink-600",
  },
  {
    slug: "edunex-pro",
    name: "EduNex Pro",
    category: "Education",
    description: "Complete school ERP with student management, attendance, fees, exams, and reporting.",
    icon: "GraduationCap",
    demo_url: "https://grade-grid-quest.lovable.app",
    color: "from-blue-600 to-indigo-600",
  },
  {
    slug: "nepali-school-demo",
    name: "Nepali School Demo",
    category: "Education",
    description: "Comprehensive school management system for Nepali educational institutions with student management, attendance, exams, fees, and reporting.",
    icon: "GraduationCap",
    demo_url: "https://sl1nk.com/waf8auj",
    color: "from-indigo-600 to-blue-600",
  },
  {
    slug: "medical-research-institute",
    name: "Medical Research Institute Management System",
    category: "Healthcare",
    description: "Comprehensive research institute management with studies, subjects, samples, compliance, and audit trails.",
    icon: "Stethoscope",
    demo_url: "https://med-sync-vault.lovable.app",
    color: "from-green-600 to-teal-600",
  },
  {
    slug: "fleetio",
    name: "Fleetio",
    category: "Logistics",
    description: "Complete fleet management with vehicles, maintenance scheduling, driver tracking, and fuel logs.",
    icon: "Truck",
    demo_url: "https://vala-fleet-ui.lovable.app",
    color: "from-orange-600 to-red-600",
  },
  {
    slug: "infra-market",
    name: "Infra.Market",
    category: "Logistics",
    description: "Heavy logistics platform for equipment transport, load tracking, and document management.",
    icon: "Truck",
    demo_url: "https://infra-fleet-view.lovable.app",
    color: "from-orange-600 to-red-600",
  },
  {
    slug: "indoor-sports-arena",
    name: "Indoor Sports Arena Management",
    category: "Sports & Recreation",
    description: "Court booking system with member management, attendance, payments, and scheduling.",
    icon: "Users",
    demo_url: "https://court-squad-pro.lovable.app",
    color: "from-red-600 to-pink-600",
  },
  {
    slug: "blinkit-clone",
    name: "Blinkit Clone",
    category: "E-commerce",
    description: "Quick commerce store dashboard with orders, inventory, delivery tracking, and analytics.",
    icon: "ShoppingBag",
    demo_url: "https://color-dash-delight.lovable.app",
    color: "from-yellow-600 to-orange-600",
  },
  {
    slug: "boatbook",
    name: "BoatBook",
    category: "Travel",
    description: "Boat booking and transport system with schedules, payments, and booking management.",
    icon: "Anchor",
    demo_url: "https://sea-charms-book.lovable.app",
    color: "from-cyan-600 to-blue-600",
  },
  {
    slug: "outdoor-sports-complex",
    name: "Outdoor Sports Complex Management",
    category: "Sports & Recreation",
    description: "Ground booking system with tournaments, member management, and facility scheduling.",
    icon: "Layers",
    demo_url: "https://turf-booker-spark.lovable.app",
    color: "from-red-600 to-pink-600",
  },
  {
    slug: "sports-equipment-store",
    name: "Sports Equipment Store",
    category: "Retail & POS",
    description: "Offline POS for sports retail with inventory, barcode scanning, and customer management.",
    icon: "ShoppingCart",
    demo_url: "https://sportspark-pos.lovable.app",
    color: "from-purple-600 to-pink-600",
  },
  {
    slug: "data-science-lab",
    name: "Data Science Lab Management System",
    category: "Research & Analytics",
    description: "Lab management system for data science teams with experiments, datasets, and collaboration tools.",
    icon: "BarChart3",
    demo_url: "https://offline-lab-keeper.lovable.app",
    color: "from-violet-600 to-purple-600",
  },
  {
    slug: "festora",
    name: "Festora™ — Festival Management OS",
    category: "Event Management",
    description: "Complete festival management with event planning, tickets, vendors, and attendee management.",
    icon: "Calendar",
    demo_url: "https://festora-os.lovable.app",
    color: "from-pink-600 to-rose-600",
  },
  {
    slug: "dental-clinic",
    name: "Dental Clinic Management System",
    category: "Healthcare",
    description: "Dental practice management with patient records, appointments, treatments, and billing.",
    icon: "Stethoscope",
    demo_url: "https://tooth-chart-buddy.lovable.app",
    color: "from-green-600 to-teal-600",
  },
  {
    slug: "printora",
    name: "Printora™ — Newspaper OS",
    category: "Publishing",
    description: "Newspaper publishing management with editorial workflow, advertising, and circulation.",
    icon: "FileText",
    demo_url: "https://printora-news-os.lovable.app",
    color: "from-gray-600 to-slate-700",
  },
  {
    slug: "decorixa",
    name: "Decorixa™ — Stage Decor OS",
    category: "Event Services",
    description: "Stage decoration and event services management with design, logistics, and billing.",
    icon: "Sparkles",
    demo_url: "https://decorix-stage-magic.lovable.app",
    color: "from-fuchsia-600 to-purple-600",
  },
];

// 12 categories required for the supplied demos
const CATEGORIES_BOOTSTRAP = [
  { slug: "public-transport", name: "Public Transport", icon: "Bus", sort_order: 0 },
  { slug: "retail-pos", name: "Retail & POS", icon: "ShoppingCart", sort_order: 1 },
  { slug: "education", name: "Education", icon: "GraduationCap", sort_order: 2 },
  { slug: "healthcare", name: "Healthcare", icon: "Stethoscope", sort_order: 3 },
  { slug: "logistics", name: "Logistics", icon: "Truck", sort_order: 4 },
  { slug: "sports-recreation", name: "Sports & Recreation", icon: "Users", sort_order: 5 },
  { slug: "ecommerce", name: "E-commerce", icon: "ShoppingBag", sort_order: 6 },
  { slug: "travel", name: "Travel", icon: "Anchor", sort_order: 7 },
  { slug: "research-analytics", name: "Research & Analytics", icon: "BarChart3", sort_order: 8 },
  { slug: "event-management", name: "Event Management", icon: "Calendar", sort_order: 9 },
  { slug: "publishing", name: "Publishing", icon: "FileText", sort_order: 10 },
  { slug: "event-services", name: "Event Services", icon: "Sparkles", sort_order: 11 },
];

export async function bootstrapSuppliedDemos() {
  if (bootstrapExecuted) return; // Only run once per process
  bootstrapExecuted = true;

  // Only run on server side
  if (typeof window !== "undefined") return;

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If keys aren't available, fail silently - can be run manually via /admin/import
    if (!url || !key) {
      console.log(
        "[bootstrap] Skipping demo import: SUPABASE_SERVICE_ROLE_KEY not configured. " +
        "Run /admin/import manually if needed."
      );
      return;
    }

    const sb = createClient(url, key);

    // Check if demos already exist (by checking if delhi-metro-app product exists)
    const { data: existing } = await sb
      .from("marketplace_products")
      .select("id")
      .eq("slug", "delhi-metro-app")
      .single();

    if (existing) {
      console.log("[bootstrap] ✓ Supplied demos already imported, skipping");
      return;
    }

    console.log("[bootstrap] Importing 16 supplied demos...");

    // 1. Upsert categories
    const categoryData = CATEGORIES_BOOTSTRAP.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      icon: cat.icon,
      tone: "primary",
      is_featured: true,
      is_hidden: false,
      sort_order: cat.sort_order,
    }));

    const { error: catError } = await sb
      .from("marketplace_categories")
      .upsert(categoryData, { onConflict: "slug" });

    if (catError) {
      console.error("[bootstrap] Category import failed:", catError.message);
      return;
    }

    // 2. Upsert products
    const productData = SUPPLIED_DEMOS_BOOTSTRAP.map((demo, idx) => ({
      slug: demo.slug,
      name: demo.name,
      industry_label: demo.category,
      icon: demo.icon,
      price_label: "₹49,999",
      price_period: "lifetime",
      rating: 4.5 + Math.random() * 0.5,
      downloads: 500 + idx * 10,
      downloads_label: `${500 + idx * 10}+`,
      badge: idx % 3 === 0 ? "HOT" : idx % 3 === 1 ? "TOP" : null,
      visible: true,
      sort_order: 1000 + idx, // Place after existing products
      is_featured: true,
      is_trending: idx < 8,
      is_new_release: idx >= 8,
      is_best_seller: false,
      is_ai: false,
    }));

    const { error: prodError, data: upsertedProds } = await sb
      .from("marketplace_products")
      .upsert(productData, { onConflict: "slug" })
      .select();

    if (prodError) {
      console.error("[bootstrap] Product import failed:", prodError.message);
      return;
    }

    // 3. Create demo URL mappings
    const demoData = SUPPLIED_DEMOS_BOOTSTRAP.map((demo, idx) => {
      const prod = upsertedProds?.[idx];
      return {
        product_id: prod?.id,
        demo_name: "Live Demo",
        role_name: "Public",
        url: demo.demo_url,
        username: null,
        password: null,
        description: `${demo.category} — ${demo.description}`,
        environment: "production",
        status: "active",
        sort_order: 1,
      };
    });

    const { error: demoError, data: demoResult } = await sb
      .from("product_demo_urls")
      .upsert(demoData, { onConflict: "product_id,url" })
      .select();

    if (demoError) {
      console.error("[bootstrap] Demo URL import failed:", demoError.message);
      return;
    }

    console.log(
      `[bootstrap] ✓ Imported 16 supplied demos: ` +
      `${upsertedProds?.length || 0} products, ` +
      `${demoResult?.length || 0} demo URLs`
    );
  } catch (err) {
    console.error("[bootstrap] Error importing supplied demos:", err);
    // Fail silently - don't crash the server
  }
}

// Export the raw demo data for use in other parts of the app
export const getSuppliedDemosData = () => SUPPLIED_DEMOS_BOOTSTRAP;
