import { createFileRoute } from "@tanstack/react-router";
import { siteUrl } from "@/lib/seo/site-url";
import { ProductDetail } from "@/components/marketplace-home/ProductDetail";
import { resolveSeoOverride } from "@/lib/seo/page-overrides";
import { getProductSeo } from "@/lib/seo/category-seo";
import { getPublicProduct } from "@/lib/marketplace.functions";

/**
 * Every product page used to send the same title and description, so all 3,700+
 * of them looked like one duplicated page to a search engine. The page now
 * loads its product on the server and describes itself: its own title, its own
 * description, its own canonical URL, the country it targets and the keyword
 * set stored on the product, plus SoftwareApplication structured data.
 *
 * If the product cannot be loaded the page still renders — the head simply
 * falls back to the generic copy rather than failing the route.
 */

type Loaded = {
  name?: string;
  description?: string | null;
  keywords?: string[];
  country?: string;
  slug?: string;
  deployment?: string | null;
  /** What the SEO Manager says about this page, when it has been given a record. */
  override?: import("@/lib/seo/page-overrides").SeoOverride | null;
  /**
   * The product itself, so the page renders on the server instead of shipping
   * a spinner. Null when it cannot be loaded, which leaves the component to
   * fetch it exactly as it did before.
   */
  product?: unknown;
};



const GENERIC = {
  title: "Product — Software Vala Marketplace",
  description: "Explore this software solution on the Software Vala marketplace.",
};

/** The target country is stored on the product as a `country:<name>` keyword. */
function readCountry(keywords: string[]): string | undefined {
  const marker = keywords.find((k) => k.startsWith("country:"));
  return marker ? marker.slice("country:".length) : undefined;
}

export const Route = createFileRoute("/marketplace/product/$slug")({
  component: ProductDetail,

  loader: async ({ params }): Promise<Loaded> => {
    // The product and its SEO are unrelated lookups, so one failing must not
    // cost the other. Settled, not all.
    const [seoResult, productResult] = await Promise.allSettled([
      getProductSeo({ data: { slug: params.slug } }),
      getPublicProduct({ data: { slug: params.slug } }),
    ]);
    const product =
      productResult.status === "fulfilled" ? productResult.value : null;
    try {
      const seo = seoResult.status === "fulfilled" ? seoResult.value : null;
      if (!seo) return { product };
      // What the SEO Manager says about this page, if anything. A record it has
      // never been given simply resolves to null and the product speaks for
      // itself, exactly as before.
      const override = await resolveSeoOverride(
        `/marketplace/product/${params.slug}`,
        {
          page_name: seo.name,
          title: seo.name,
          product: seo.name,
          country: seo.country ?? undefined,
          industry: seo.deployment ?? undefined,
          excerpt: seo.description ?? undefined,
        },
      );
      return {
        name: seo.name,
        description: seo.description,
        keywords: seo.keywords,
        country: seo.country,
        slug: params.slug,
        deployment: seo.deployment,
        override,
        product,
      };
    } catch (error) {
      console.error("[product head] could not load", params.slug, error);
      return { product };
    }
  },

  head: ({ loaderData }) => {
    const data = (loaderData ?? {}) as Loaded;
    if (!data.name) {
      return { meta: [{ title: GENERIC.title }, { name: "description", content: GENERIC.description }] };
    }

    const override = data.override ?? null;

    const defaultTitle = data.country
      ? `${data.name} — ${data.country} | Software Vala`
      : `${data.name} | Software Vala`;
    const defaultDescription =
      (data.description && data.description.trim()) ||
      (data.country
        ? `${data.name} for businesses in ${data.country}. Live demo, one-time lifetime licence, on Software Vala.`
        : `${data.name} on Software Vala. Live demo and one-time lifetime licence.`);

    // The Manager wins where it has something to say, and only there.
    const title = override?.title ?? defaultTitle;
    const description = override?.description ?? defaultDescription;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (data.keywords?.length) {
      meta.push({ name: "keywords", content: data.keywords.join(", ") });
    }
    if (data.country) {
      meta.push({ name: "geo.placename", content: data.country });
    }

    // A canonical the Manager has set for this page wins, unless it points at
    // the testing domain, which the resolver already refuses.
    const canonical = override?.canonical ?? `${siteUrl()}/marketplace/product/${data.slug}`;
    if (override?.noindex) {
      meta.push({ name: "robots", content: "noindex, follow" });
    }
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: data.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: data.deployment || "Web",
      description,
      url: canonical,
      brand: { "@type": "Brand", name: "Software Vala" },
      ...(data.country ? { areaServed: data.country } : {}),
    };

    return {
      meta,
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(schema) }],
    };
  },
});
