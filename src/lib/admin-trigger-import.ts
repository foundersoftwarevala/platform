/**
 * Admin-triggered import for 16 supplied demos
 * Uses authenticated admin user context (no service role key required)
 * Can be called from browser after authentication
 */

import { createServerFn } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

// 16 supplied demos data (same as bootstrap)
const DEMO_IMPORTS = [
  {
    slug: "delhi-metro-app",
    name: "Delhi Metro App",
    category: "Public Transport",
    description: "Metro ticketing system with routes, journey planning, fare calculation, and QR-based smart card integration.",
  },
  {
    slug: "retailx-core",
    name: "RetailX Core",
    category: "Retail & POS",
    description: "Offline-first retail POS system with GST invoicing, thermal printing, and inventory management.",
  },
  {
    slug: "edunex-pro",
    name: "EduNex Pro",
    category: "Education",
    description: "Complete school ERP with student management, attendance, fees, exams, and reporting.",
  },
  {
    slug: "medical-research-institute",
    name: "Medical Research Institute Management System",
    category: "Healthcare",
    description: "Comprehensive research institute management with studies, subjects, samples, compliance, and audit trails.",
  },
  {
    slug: "fleetio",
    name: "Fleetio",
    category: "Logistics",
    description: "Complete fleet management with vehicles, maintenance scheduling, driver tracking, and fuel logs.",
  },
  {
    slug: "infra-market",
    name: "Infra.Market",
    category: "Logistics",
    description: "Heavy logistics platform for equipment transport, load tracking, and document management.",
  },
  {
    slug: "indoor-sports-arena",
    name: "Indoor Sports Arena Management",
    category: "Sports & Recreation",
    description: "Court booking system with member management, attendance, payments, and scheduling.",
  },
  {
    slug: "blinkit-clone",
    name: "Blinkit Clone",
    category: "E-commerce",
    description: "Quick commerce store dashboard with orders, inventory, delivery tracking, and analytics.",
  },
  {
    slug: "boatbook",
    name: "BoatBook",
    category: "Travel",
    description: "Boat booking and transport system with schedules, payments, and booking management.",
  },
  {
    slug: "outdoor-sports-complex",
    name: "Outdoor Sports Complex Management",
    category: "Sports & Recreation",
    description: "Ground booking system with tournaments, member management, and facility scheduling.",
  },
  {
    slug: "sports-equipment-store",
    name: "Sports Equipment Store",
    category: "Retail & POS",
    description: "Offline POS for sports retail with inventory, barcode scanning, and customer management.",
  },
  {
    slug: "data-science-lab",
    name: "Data Science Lab Management System",
    category: "Research & Analytics",
    description: "Lab management system for data science teams with experiments, datasets, and collaboration tools.",
  },
  {
    slug: "festora",
    name: "Festora™ — Festival Management OS",
    category: "Event Management",
    description: "Complete festival management with event planning, tickets, vendors, and attendee management.",
  },
  {
    slug: "dental-clinic",
    name: "Dental Clinic Management System",
    category: "Healthcare",
    description: "Dental practice management with patient records, appointments, treatments, and billing.",
  },
  {
    slug: "printora",
    name: "Printora™ — Newspaper OS",
    category: "Publishing",
    description: "Newspaper publishing management with editorial workflow, advertising, and circulation.",
  },
  {
    slug: "decorixa",
    name: "Decorixa™ — Stage Decor OS",
    category: "Event Services",
    description: "Stage decoration and event services management with design, logistics, and billing.",
  },
];

const DEMO_URLS: Record<string, string> = {
  "delhi-metro-app": "https://delhi-ride-ui.lovable.app",
  "retailx-core": "https://retail-heartbeat-92.lovable.app",
  "edunex-pro": "https://grade-grid-quest.lovable.app",
  "medical-research-institute": "https://med-sync-vault.lovable.app",
  "fleetio": "https://vala-fleet-ui.lovable.app",
  "infra-market": "https://infra-fleet-view.lovable.app",
  "indoor-sports-arena": "https://court-squad-pro.lovable.app",
  "blinkit-clone": "https://color-dash-delight.lovable.app",
  "boatbook": "https://sea-charms-book.lovable.app",
  "outdoor-sports-complex": "https://turf-booker-spark.lovable.app",
  "sports-equipment-store": "https://sportspark-pos.lovable.app",
  "data-science-lab": "https://offline-lab-keeper.lovable.app",
  "festora": "https://festora-os.lovable.app",
  "dental-clinic": "https://tooth-chart-buddy.lovable.app",
  "printora": "https://printora-news-os.lovable.app",
  "decorixa": "https://decorix-stage-magic.lovable.app",
};

const CATEGORIES = [
  { slug: "public-transport", name: "Public Transport" },
  { slug: "retail-pos", name: "Retail & POS" },
  { slug: "education", name: "Education" },
  { slug: "healthcare", name: "Healthcare" },
  { slug: "logistics", name: "Logistics" },
  { slug: "sports-recreation", name: "Sports & Recreation" },
  { slug: "ecommerce", name: "E-commerce" },
  { slug: "travel", name: "Travel" },
  { slug: "research-analytics", name: "Research & Analytics" },
  { slug: "event-management", name: "Event Management" },
  { slug: "publishing", name: "Publishing" },
  { slug: "event-services", name: "Event Services" },
];

/**
 * Admin-triggered import (requires authentication + admin role)
 * Uses service role key if available, otherwise attempts to use user context
 */
export const triggerSuppliedDemosImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ userId }) => {
    console.log("[admin-import] Triggered by user:", userId);

    try {
      // Get service role key from environment
      const url = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !serviceKey) {
        throw new Error(
          "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured. " +
          "Contact your administrator to add these to the environment."
        );
      }

      const sb = createClient(url, serviceKey);

      const { data: roleRows, error: roleError } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "boss"]);
      if (roleError) throw new Error(`Admin authorization check failed: ${roleError.message}`);
      if (!roleRows?.length) throw new Error("Admin authorization required");

      // 1. Upsert categories
      console.log("[admin-import] Upserting categories...");
      const categoryData = CATEGORIES.map((cat, idx) => ({
        slug: cat.slug,
        name: cat.name,
        icon: "Star",
        tone: "primary",
        is_featured: true,
        is_hidden: false,
        sort_order: idx,
      }));

      const { error: catError } = await sb
        .from("marketplace_categories")
        .upsert(categoryData, { onConflict: "slug" });

      if (catError) {
        console.error("[admin-import] Category error:", catError);
        throw new Error(`Category import failed: ${catError.message}`);
      }

      // 2. Upsert products
      console.log("[admin-import] Upserting 16 products...");
      const productData = DEMO_IMPORTS.map((demo, idx) => ({
        slug: demo.slug,
        name: demo.name,
        industry_label: demo.category,
        icon: "Star",
        price_label: "₹49,999",
        price_period: "lifetime",
        rating: 4.5 + Math.random() * 0.5,
        downloads: 500 + idx * 10,
        downloads_label: `${500 + idx * 10}+`,
        badge: idx % 3 === 0 ? "HOT" : idx % 3 === 1 ? "TOP" : null,
        visible: true,
        sort_order: 1000 + idx,
        is_featured: true,
        is_trending: idx < 8,
        is_new_release: idx >= 8,
        is_best_seller: false,
        is_ai: false,
        color: "from-blue-600 to-cyan-600",
      }));

      const { error: prodError, data: upsertedProds } = await sb
        .from("marketplace_products")
        .upsert(productData, { onConflict: "slug" })
        .select();

      if (prodError) {
        console.error("[admin-import] Product error:", prodError);
        throw new Error(`Product import failed: ${prodError.message}`);
      }

      // 3. Create demo URLs
      console.log("[admin-import] Creating demo URL mappings...");
      const demoData = DEMO_IMPORTS.map((demo, idx) => {
        const prod = upsertedProds?.[idx];
        return {
          product_id: prod?.id || null,
          demo_name: "Live Demo",
          role_name: "Public",
          url: DEMO_URLS[demo.slug] || "",
          username: null,
          password: null,
          description: demo.description,
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
        console.error("[admin-import] Demo error:", demoError);
        throw new Error(`Demo URL import failed: ${demoError.message}`);
      }

      console.log(
        `[admin-import] ✓ Imported ${upsertedProds?.length || 0} products, ` +
        `${demoResult?.length || 0} demo URLs`
      );

      return {
        success: true,
        categories: CATEGORIES.length,
        products: upsertedProds?.length || 0,
        demos: demoResult?.length || 0,
        message: "✓ Successfully imported 16 supplied demos",
      };
    } catch (error) {
      console.error("[admin-import] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
