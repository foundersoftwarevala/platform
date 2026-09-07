import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The published product copy, for the storefront.
 *
 * Four of the nine content types the AI Content Generator produces are written
 * into stores the site already reads — the product's own description, the SEO
 * page record, the product keywords and the FAQ table — so they need nothing
 * here. The other five (summary, long description, features, benefits and use
 * cases) had no consumer at all: the product page selected description and
 * features and rendered neither. This is what makes those blocks visible, so
 * "published" means something a visitor can see.
 *
 * Only PUBLISHED rows for a visible, undeleted product are returned. That rule
 * lives in mm_product_content and in the row-level policy behind it, not here.
 */

export type PublishedBlock = {
  content: string | null;
  items: unknown;
  provenance: string;
  human_edited: boolean;
  published_at: string | null;
};

export type PublishedContent = Partial<Record<
  "summary" | "short_description" | "long_description" | "seo_description" |
  "meta_keywords" | "faq" | "features" | "benefits" | "use_cases",
  PublishedBlock
>>;

export const getPublishedProductContent = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data }): Promise<PublishedContent> => {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return {};
    try {
      const res = await fetch(`${url}/rest/v1/rpc/mm_product_content`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_slug: data.slug }),
      });
      if (!res.ok) return {};
      return ((await res.json()) as PublishedContent) ?? {};
    } catch (error) {
      // The product page must render whether or not this answers.
      console.error("[product content] could not load", data.slug, error);
      return {};
    }
  });
