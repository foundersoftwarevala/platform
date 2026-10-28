import { createServerFn } from "@tanstack/react-start";
import { callVpsPublicFunction } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * Read the catalogue counts for the homepage metadata. If the VPS query fails
 * or takes too long, the homepage keeps its number-free fallback.
 */
export type CatalogueHeadline = {
  products: number;
  categories: number;
  visibleCategories: number;
};

export const getCatalogueHeadline = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogueHeadline | null> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const row = await Promise.race([
        callVpsPublicFunction("sf_catalogue_headline"),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("VPS catalogue headline query timed out.")),
            1500,
          );
        }),
      ]);
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const products = Number(row.products ?? 0) || 0;
      const categories = Number(row.categories ?? 0) || 0;
      if (products <= 0 || categories <= 0) return null;
      return {
        products,
        categories,
        visibleCategories: Number(row.visible_categories ?? categories) || categories,
      };
    } catch (error) {
      console.error("[catalogue headline] VPS read failed", error);
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  },
);
