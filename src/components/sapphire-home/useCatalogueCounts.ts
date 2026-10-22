import { useMatch } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The catalogue's real size, counted by the database in the "/" loader.
 *
 * The feature strip said "204+ Solutions" and "20 Live Demos", the footer
 * "55 Master Categories", the AI Zone "200+ products" - numbers written by hand
 * while the catalogue holds over seven thousand visible products. They read the
 * Products and live demos come from mm_marketplace_stats; products are limited
 * to visible, published rows. Each value is null when its lookup failed, so the
 * caller shows no number rather than a stale or invented one.
 */
export type CatalogueCounts = {
  products: number | null;
  categories: number | null;
  liveDemos: number | null;
  /** The number, formatted for the visitor's language. */
  format: (value: number) => string;
};

type HomeLoaderData = {
  headline?: { products?: number; visibleCategories?: number } | null;
  stats?: { products?: number; categories?: number; liveDemos?: number } | null;
  seo?: { language: string; formattedCounts?: Record<string, string> };
};

const positive = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

export function publishedProductCount(stats: HomeLoaderData["stats"] | undefined): number | null {
  return positive(stats?.products);
}

export function useCatalogueCounts(): CatalogueCounts {
  const { formatNumber, lang } = useTranslation();
  const match = useMatch({ from: "/", shouldThrow: false });
  const data = (match?.loaderData ?? {}) as HomeLoaderData;
  return {
    products: publishedProductCount(data.stats),
    categories: positive(data.headline?.visibleCategories) ?? positive(data.stats?.categories),
    liveDemos: positive(data.stats?.liveDemos),
    format: (value: number) =>
      (data.seo?.language === lang ? data.seo.formattedCounts?.[value] : undefined) ??
      formatNumber(value),
  };
}
