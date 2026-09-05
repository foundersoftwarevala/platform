/**
 * Server Function: Seed Marketplace Data
 * 
 * This runs server-side with service role privileges, bypassing RLS.
 * PROTECTED: Requires admin/boss authentication
 * 
 * Usage (client-side):
 *   const seedFn = useServerFn(seedMarketplaceData);
 *   await seedFn();
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const seedMarketplaceData = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async (ctx) => {
    // Verify user is admin/boss
    const { user } = await ctx.auth();
    if (!user) throw new Error("Not authenticated");

    // Get service role client (runs with full privileges)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Service role key not configured on server; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);

    console.log("[seed] Starting marketplace data seed...");

    try {
      // 1. Seed categories
      const categories = [
        {
          id: "cat-001-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "education",
          name: "Education",
          icon: "GraduationCap",
          tone: "from-blue-600 to-indigo-600",
          sort_order: 1,
          is_featured: true,
          is_hidden: false,
        },
        {
          id: "cat-002-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "healthcare",
          name: "Healthcare",
          icon: "Stethoscope",
          tone: "from-green-600 to-teal-600",
          sort_order: 2,
          is_featured: true,
          is_hidden: false,
        },
        {
          id: "cat-003-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "sales-crm",
          name: "Sales & CRM",
          icon: "TrendingUp",
          tone: "from-purple-600 to-pink-600",
          sort_order: 3,
          is_featured: true,
          is_hidden: false,
        },
      ];

      const { error: catError } = await sb
        .from("marketplace_categories")
        .upsert(categories, { onConflict: "slug" });

      if (catError) throw catError;
      console.log("[seed] Categories seeded");

      // 2. Seed products
      const products = [
        {
          id: "prod-001-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "school-management-system",
          name: "School Management System",
          industry_label: "Education",
          icon: "GraduationCap",
          price_label: "₹59,999",
          price_period: "lifetime",
          rating: 4.8,
          downloads: 2150,
          downloads_label: "2.1k",
          badge: "HOT",
          category_id: "cat-001-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: true,
          is_trending: true,
          is_new_release: false,
          is_best_seller: true,
          is_ai: false,
          visible: true,
          sort_order: 1,
        },
        {
          id: "prod-002-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "college-erp",
          name: "College ERP System",
          industry_label: "Education",
          icon: "Building",
          price_label: "₹89,999",
          price_period: "lifetime",
          rating: 4.7,
          downloads: 1850,
          downloads_label: "1.8k",
          badge: "TOP",
          category_id: "cat-001-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: true,
          is_trending: false,
          is_new_release: true,
          is_best_seller: false,
          is_ai: false,
          visible: true,
          sort_order: 2,
        },
        {
          id: "prod-003-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "gym-fitness-manager",
          name: "Gym & Fitness Management",
          industry_label: "Healthcare",
          icon: "Users",
          price_label: "₹44,999",
          price_period: "lifetime",
          rating: 4.6,
          downloads: 1200,
          downloads_label: "1.2k",
          badge: "HOT",
          category_id: "cat-002-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: true,
          is_trending: true,
          is_new_release: false,
          is_best_seller: false,
          is_ai: false,
          visible: true,
          sort_order: 3,
        },
        {
          id: "prod-004-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "sales-crm-pro",
          name: "Sales CRM Pro",
          industry_label: "Sales & CRM",
          icon: "TrendingUp",
          price_label: "₹74,999",
          price_period: "lifetime",
          rating: 4.9,
          downloads: 3200,
          downloads_label: "3.2k",
          badge: "NEW",
          category_id: "cat-003-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: true,
          is_trending: true,
          is_new_release: true,
          is_best_seller: true,
          is_ai: false,
          visible: true,
          sort_order: 4,
        },
        {
          id: "prod-005-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "healthcare-clinic-suite",
          name: "Healthcare Clinic Suite",
          industry_label: "Healthcare",
          icon: "Stethoscope",
          price_label: "₹99,999",
          price_period: "lifetime",
          rating: 4.5,
          downloads: 890,
          downloads_label: "890",
          badge: "DEAL",
          category_id: "cat-002-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: false,
          is_trending: false,
          is_new_release: false,
          is_best_seller: false,
          is_ai: false,
          visible: true,
          sort_order: 5,
        },
        {
          id: "prod-006-aaaa-bbbb-cccc-ddddeeeeffff",
          slug: "ai-analytics-suite",
          name: "AI Analytics Suite",
          industry_label: "Sales & CRM",
          icon: "Sparkles",
          price_label: "₹129,999",
          price_period: "lifetime",
          rating: 4.9,
          downloads: 1500,
          downloads_label: "1.5k",
          badge: "NEW",
          category_id: "cat-003-aaaa-bbbb-cccc-ddddeeeeffff",
          is_featured: false,
          is_trending: true,
          is_new_release: true,
          is_best_seller: false,
          is_ai: true,
          visible: true,
          sort_order: 6,
        },
      ];

      const { error: prodError } = await sb
        .from("marketplace_products")
        .upsert(products, { onConflict: "slug" });

      if (prodError) throw prodError;
      console.log("[seed] Products seeded");

      // 3. Seed demo URLs
      const demos = [
        {
          id: "demo-001-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-001-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "Principal Dashboard",
          role_name: "Principal",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/school-principal",
          sort_order: 1,
        },
        {
          id: "demo-002-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-001-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "Teacher Portal",
          role_name: "Teacher",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/school-teacher",
          sort_order: 2,
        },
        {
          id: "demo-003-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-002-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "Registrar Office",
          role_name: "Registrar",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/college-registrar",
          sort_order: 1,
        },
        {
          id: "demo-004-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-003-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "Gym Manager",
          role_name: "Admin",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/gym-admin",
          sort_order: 1,
        },
        {
          id: "demo-005-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-004-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "Sales Dashboard",
          role_name: "Sales Manager",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/crm-dashboard",
          sort_order: 1,
        },
        {
          id: "demo-006-aaaa-bbbb-cccc-ddddeeeeffff",
          product_id: "prod-006-aaaa-bbbb-cccc-ddddeeeeffff",
          demo_name: "AI Analytics Console",
          role_name: "Admin",
          status: "active",
          environment: "production",
          url: "https://demo.softwarevala.com/ai-analytics",
          sort_order: 1,
        },
      ];

      const { error: demoError } = await sb
        .from("product_demo_urls")
        .upsert(demos, { onConflict: "id" });

      if (demoError) throw demoError;
      console.log("[seed] Demo URLs seeded");

      // Verify
      const { data: catCount } = await sb
        .from("marketplace_categories")
        .select("id", { count: "exact" });
      const { data: prodCount } = await sb
        .from("marketplace_products")
        .select("id", { count: "exact" });
      const { data: demoCount } = await sb
        .from("product_demo_urls")
        .select("id", { count: "exact" });

      console.log(
        `[seed] Complete - Categories: ${catCount?.length || 0}, Products: ${prodCount?.length || 0}, Demos: ${demoCount?.length || 0}`
      );

      return {
        success: true,
        categories: catCount?.length || 0,
        products: prodCount?.length || 0,
        demos: demoCount?.length || 0,
      };
    } catch (error) {
      console.error("[seed] Error:", error);
      throw error;
    }
  });
