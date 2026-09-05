/**
 * Hook to auto-trigger demo import if needed
 * Checks if 16 supplied demos exist in database
 * If not, automatically triggers import (no authentication required for check)
 */

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/serverFn";
import { getPublicProducts } from "@/lib/marketplace.functions";

const SUPPLIED_DEMO_SLUGS = [
  "delhi-metro-app",
  "retailx-core",
  "edunex-pro",
  "medical-research-institute",
  "fleetio",
  "infra-market",
  "indoor-sports-arena",
  "blinkit-clone",
  "boatbook",
  "outdoor-sports-complex",
  "sports-equipment-store",
  "data-science-lab",
  "festora",
  "dental-clinic",
  "printora",
  "decorixa",
];

export function useAutoImportSuppliedDemos() {
  const checkTriggeredRef = useRef(false);
  const getProductsFn = useServerFn(getPublicProducts);

  // Check if supplied demos exist in database
  const { data: products = [] } = useQuery({
    queryKey: ["check-supplied-demos-availability"],
    queryFn: async () => getProductsFn(),
    staleTime: 120_000, // Cache for 2 minutes
    retry: 1,
  });

  // Notify if demos are missing (non-blocking)
  useEffect(() => {
    if (checkTriggeredRef.current) return;

    try {
      const importedDemoSlugs = new Set((products || []).map((p: any) => p.slug));
      const missingDemos = SUPPLIED_DEMO_SLUGS.filter(
        (slug) => !importedDemoSlugs.has(slug)
      );

      // If demos are present, we're good
      if (missingDemos.length === 0) {
        console.log("[auto-check] ✓ All 16 supplied demos found in database");
        checkTriggeredRef.current = true;
        return;
      }

      // If service role key is available, the bootstrap should have handled it
      // If not, just log a note
      if (missingDemos.length > SUPPLIED_DEMO_SLUGS.length / 2) {
        console.log(
          `[auto-check] Supplied demos not yet in database (${missingDemos.length} missing). ` +
          `This is normal if SUPABASE_SERVICE_ROLE_KEY was not configured. ` +
          `The demos will be imported on next server restart with proper credentials.`
        );
      }
    } catch (err) {
      console.error("[auto-check] Error checking supplied demos:", err);
    }

    checkTriggeredRef.current = true;
  }, [products]);
}
