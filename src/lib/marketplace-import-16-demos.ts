/**
 * Import 16 Supplied Demo Records
 * Non-destructive: Only inserts, upserts existing records by product_id/slug
 * Uses exact supplied data: names, categories, URLs, branding
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ============= EXACT 16 DEMO RECORDS =============
const DEMO_CATALOG = [
  {
    slug: "delhi-metro-app",
    name: "Delhi Metro App",
    category: "Metro Ticketing",
    masterCategory: "Public Transport",
    description: "Metro ticketing system with routes, journey planning, fare calculation, and QR-based smart card integration.",
    icon: "Bus",
    demo_name: "Live Demo",
    demo_url: "https://delhi-ride-ui.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "retailx-core",
    name: "RetailX Core",
    category: "Retail Billing",
    masterCategory: "Retail & POS",
    description: "Offline-first retail POS system with GST invoicing, thermal printing, and inventory management.",
    icon: "ShoppingCart",
    demo_name: "POS Dashboard",
    demo_url: "https://retail-heartbeat-92.lovable.app",
    branding: "",
  },
  {
    slug: "edunex-pro",
    name: "EduNex Pro",
    category: "School Management",
    masterCategory: "Education",
    description: "Complete school ERP with student management, attendance, fees, exams, and reporting.",
    icon: "GraduationCap",
    demo_name: "Admin Dashboard",
    demo_url: "https://grade-grid-quest.lovable.app",
    branding: "",
  },
  {
    slug: "nepali-school-demo",
    name: "Nepali School Demo",
    category: "School Management",
    masterCategory: "Education",
    description: "Comprehensive school management system for Nepali educational institutions with student management, attendance, exams, fees, and reporting.",
    icon: "GraduationCap",
    demo_name: "Live Demo",
    demo_url: "https://sl1nk.com/waf8auj",
    branding: "Software Vala™",
  },
  {
    slug: "medical-research-institute",
    name: "Medical Research Institute Management System",
    category: "Medical Research",
    masterCategory: "Healthcare",
    description: "Comprehensive research institute management with studies, subjects, samples, compliance, and audit trails.",
    icon: "Stethoscope",
    demo_name: "Research Console",
    demo_url: "https://med-sync-vault.lovable.app",
    branding: "Software Vala™",
  },
  {
    slug: "fleetio",
    name: "Fleetio",
    category: "Fleet Management",
    masterCategory: "Logistics",
    description: "Complete fleet management with vehicles, maintenance scheduling, driver tracking, and fuel logs.",
    icon: "Truck",
    demo_name: "Fleet Dashboard",
    demo_url: "https://vala-fleet-ui.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "infra-market",
    name: "Infra.Market",
    category: "Heavy Equipment Transport",
    masterCategory: "Logistics",
    description: "Heavy logistics platform for equipment transport, load tracking, and document management.",
    icon: "Truck",
    demo_name: "Logistics Console",
    demo_url: "https://infra-fleet-view.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "indoor-sports-arena",
    name: "Indoor Sports Arena Management",
    category: "Sports Arena",
    masterCategory: "Sports & Recreation",
    description: "Court booking system with member management, attendance, payments, and scheduling.",
    icon: "Users",
    demo_name: "Arena Manager",
    demo_url: "https://court-squad-pro.lovable.app",
    branding: "",
  },
  {
    slug: "blinkit-clone",
    name: "Blinkit Clone",
    category: "Quick Commerce",
    masterCategory: "E-commerce",
    description: "Quick commerce store dashboard with orders, inventory, delivery tracking, and analytics.",
    icon: "ShoppingBag",
    demo_name: "Store Dashboard",
    demo_url: "https://color-dash-delight.lovable.app",
    branding: "",
  },
  {
    slug: "boatbook",
    name: "BoatBook",
    category: "Boat Transport",
    masterCategory: "Travel",
    description: "Boat booking and transport system with schedules, payments, and booking management.",
    icon: "Anchor",
    demo_name: "Booking Platform",
    demo_url: "https://sea-charms-book.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "outdoor-sports-complex",
    name: "Outdoor Sports Complex Management",
    category: "Sports Complex",
    masterCategory: "Sports & Recreation",
    description: "Ground booking system with tournaments, member management, and facility scheduling.",
    icon: "Layers",
    demo_name: "Sports Manager",
    demo_url: "https://turf-booker-spark.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "sports-equipment-store",
    name: "Sports Equipment Store",
    category: "Sports Retail",
    masterCategory: "Retail & POS",
    description: "Offline POS for sports retail with inventory, barcode scanning, and customer management.",
    icon: "ShoppingCart",
    demo_name: "Store Manager",
    demo_url: "https://sportspark-pos.lovable.app",
    branding: "Powered by Software Vala™",
  },
  {
    slug: "data-science-lab",
    name: "Data Science Lab Management System",
    category: "Data Science",
    masterCategory: "Research & Analytics",
    description: "Lab management system for data science teams with experiments, datasets, and collaboration tools.",
    icon: "BarChart3",
    demo_name: "Lab Console",
    demo_url: "https://offline-lab-keeper.lovable.app",
    branding: "",
  },
  {
    slug: "festora",
    name: "Festora™ — Festival Management OS",
    category: "Festival",
    masterCategory: "Event Management",
    description: "Complete festival management with event planning, tickets, vendors, and attendee management.",
    icon: "Calendar",
    demo_name: "Festival OS",
    demo_url: "https://festora-os.lovable.app",
    branding: "",
  },
  {
    slug: "dental-clinic",
    name: "Dental Clinic Management System",
    category: "Dental Clinic",
    masterCategory: "Healthcare",
    description: "Dental practice management with patient records, appointments, treatments, and billing.",
    icon: "Stethoscope",
    demo_name: "Clinic Manager",
    demo_url: "https://tooth-chart-buddy.lovable.app",
    branding: "",
  },
  {
    slug: "printora",
    name: "Printora™ — Newspaper OS",
    category: "Newspaper",
    masterCategory: "Publishing",
    description: "Newspaper publishing management with editorial workflow, advertising, and circulation.",
    icon: "FileText",
    demo_name: "Publishing OS",
    demo_url: "https://printora-news-os.lovable.app",
    branding: "",
  },
  {
    slug: "decorixa",
    name: "Decorixa™ — Stage Decor OS",
    category: "Stage Decoration",
    masterCategory: "Event Services",
    description: "Stage decoration and event services management with design, logistics, and billing.",
    icon: "Sparkles",
    demo_name: "Decor Manager",
    demo_url: "https://decorix-stage-magic.lovable.app",
    branding: "",
  },
];

// ============= CATEGORIES REQUIRED =============
const CATEGORIES_NEEDED = [
  { slug: "public-transport", name: "Public Transport", icon: "Bus", tone: "from-blue-600 to-cyan-600" },
  { slug: "retail-pos", name: "Retail & POS", icon: "ShoppingCart", tone: "from-purple-600 to-pink-600" },
  { slug: "education", name: "Education", icon: "GraduationCap", tone: "from-blue-600 to-indigo-600" },
  { slug: "healthcare", name: "Healthcare", icon: "Stethoscope", tone: "from-green-600 to-teal-600" },
  { slug: "logistics", name: "Logistics", icon: "Truck", tone: "from-orange-600 to-red-600" },
  { slug: "sports-recreation", name: "Sports & Recreation", icon: "Users", tone: "from-red-600 to-pink-600" },
  { slug: "ecommerce", name: "E-commerce", icon: "ShoppingBag", tone: "from-yellow-600 to-orange-600" },
  { slug: "travel", name: "Travel", icon: "Anchor", tone: "from-cyan-600 to-blue-600" },
  { slug: "research-analytics", name: "Research & Analytics", icon: "BarChart3", tone: "from-violet-600 to-purple-600" },
  { slug: "event-management", name: "Event Management", icon: "Calendar", tone: "from-pink-600 to-rose-600" },
  { slug: "publishing", name: "Publishing", icon: "FileText", tone: "from-gray-600 to-slate-700" },
  { slug: "event-services", name: "Event Services", icon: "Sparkles", tone: "from-fuchsia-600 to-purple-600" },
];

// Use Supabase client from auth context OR service role (for dev/localhost)
export const importSupplied16Demos = createServerFn({ method: "POST" })
  .handler(async (ctx) => {
    console.log("[import-16] Starting import of 16 supplied demos...");

    try {
      // Try to get service role client first (for localhost dev)
      const sbServiceRole = createSupabaseServerClient();
      const sb = sbServiceRole;

      // 1. Upsert categories
      console.log("[import-16] Upserting categories...");
      const categoryData = CATEGORIES_NEEDED.map((cat, idx) => ({
        slug: cat.slug,
        name: cat.name,
        icon: cat.icon,
        tone: cat.tone,
        is_featured: true,
        is_hidden: false,
        sort_order: idx,
      }));

      const { error: catError, data: upsertedCats } = await sb
        .from("marketplace_categories")
        .upsert(categoryData, { onConflict: "slug" });

      if (catError) throw new Error(`Category upsert failed: ${catError.message}`);
      console.log(`[import-16] ✓ ${upsertedCats?.length || 0} categories ready`);

      // 2. Upsert products
      console.log("[import-16] Upserting 16 products...");
      const productData = DEMO_CATALOG.map((demo, idx) => ({
        slug: demo.slug,
        name: demo.name,
        industry_label: demo.category,
        icon: demo.icon,
        price_label: "₹49,999",
        price_period: "lifetime",
        rating: 4.5,
        downloads: 500 + idx * 10,
        downloads_label: `${500 + idx * 10}`,
        badge: idx % 3 === 0 ? "HOT" : idx % 3 === 1 ? "TOP" : null,
        visible: true,
        sort_order: idx + 1,
        is_featured: true,
        is_trending: idx < 8,
        is_new_release: idx >= 8,
        is_best_seller: false,
        is_ai: false,
      }));

      const { error: prodError, data: upsertedProds } = await sb
        .from("marketplace_products")
        .upsert(productData, { onConflict: "slug" });

      if (prodError) throw new Error(`Product upsert failed: ${prodError.message}`);
      console.log(`[import-16] ✓ ${upsertedProds?.length || 0} products created/linked`);

      // 3. Create demo URL mappings
      console.log("[import-16] Creating demo URL mappings...");
      const demoData = DEMO_CATALOG.map((demo, idx) => {
        const prod = upsertedProds?.[idx];
        return {
          product_id: prod?.id || null,
          demo_name: demo.demo_name,
          role_name: "Public",
          url: demo.demo_url,
          username: null,
          password: null,
          description: `${demo.masterCategory} — ${demo.description}${demo.branding ? ` — ${demo.branding}` : ""}`,
          environment: "production",
          status: "active",
          sort_order: 1,
        };
      });

      const { error: demoError, data: upsertedDemos } = await sb
        .from("product_demo_urls")
        .upsert(demoData, { onConflict: "product_id,url" });

      if (demoError) throw new Error(`Demo URL upsert failed: ${demoError.message}`);
      console.log(`[import-16] ✓ ${upsertedDemos?.length || 0} demo URLs created/linked`);

      console.log(`[import-16] COMPLETE - Import finished successfully`);

      return {
        success: true,
        categories: upsertedCats?.length || 0,
        products: upsertedProds?.length || 0,
        demos: upsertedDemos?.length || 0,
        message: "✓ All 16 supplied demos imported successfully",
      };
    } catch (error) {
      console.error("[import-16] Error:", error);
      throw error;
    }
  });

// Helper to create service role client
function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in environment");
  }
  
  return createClient(url, key);
}
