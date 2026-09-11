import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { siteUrl } from "@/lib/seo/site-url";
import { ProductDetail, ProductNotFound } from "@/components/marketplace-home/ProductDetail";
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

function ProductNotFoundPage() {
  const { slug } = useParams({ from: "/marketplace/product/$slug" });
  return <ProductNotFound slug={slug} />;
}

export const Route = createFileRoute("/marketplace/product/$slug")({
  component: ProductDetail,
  // The same "Product Not Found" card the page has always drawn, now rendered
  // for a real 404 instead of inside a 200.
  notFoundComponent: ProductNotFoundPage,

  loader: async ({ params }): Promise<Loaded> => {
    // The product and its SEO are unrelated lookups, so one failing must not
    // cost the other. Settled, not all.
    const [seoResult, productResult] = await Promise.allSettled([
      getProductSeo({ data: { slug: params.slug } }),
      getPublicProduct({ data: { slug: params.slug } }),
    ]);
    const product =
      productResult.status === "fulfilled" ? productResult.value : null;
    // Every unknown or non-public slug used to answer 200 - a soft 404 a
    // search engine keeps crawling. The catalogue has to have answered "no such
    // public product" for this to fire: a lookup that failed or could not reach
    // the database leaves `not_found` unset and the page renders as before.
    if (product?.not_found) {
      throw notFound();
    }
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

  head: ({ loaderData, match }) => {
    // The loader answered 404: there is no loader data, so without this the
    // generic product copy below would be sent, indexable, for a missing page.
    if (match.status === "notFound") {
      return {
        meta: [
          { title: "Product not found — Software Vala" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const data = (loaderData ?? {}) as Loaded;
    // No public product behind this URL - an unknown slug, or one that is
    // hidden, a draft or outside its schedule. The page says "not found", so the
    // head must not describe it as a product or offer it to a search engine.
    // (The SEO lookup is separate and would otherwise name a draft product.)
    const publicProduct = (data.product as { product?: unknown } | null | undefined)?.product;
    if (data.product !== undefined && !publicProduct) {
      return {
        meta: [
          { title: "Product not found — Software Vala" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
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
      { property: "og:url", content: override?.canonical ?? `${siteUrl()}/marketplace/product/${data.slug}` },
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
    // The product's own price, as the storefront shows it, becomes the offer.
    // Without `offers` a SoftwareApplication is not eligible for rich results.
    // Only a label that states an amount and a currency is used; "Custom" or
    // "Contact" yields no offer rather than an invented one.
    const priceLabel = String(
      (publicProduct as { price_label?: string | null } | undefined)?.price_label ?? "",
    );
    const priceMatch = priceLabel.match(/^\s*([$₹€£])\s?([\d,]+(?:\.\d+)?)\s*$/);
    const CURRENCY: Record<string, string> = { $: "USD", "₹": "INR", "€": "EUR", "£": "GBP" };
    const offers = priceMatch
      ? {
          offers: {
            "@type": "Offer",
            price: priceMatch[2].replace(/,/g, ""),
            priceCurrency: CURRENCY[priceMatch[1]],
            availability: "https://schema.org/InStock",
            url: canonical,
          },
        }
      : {};

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
      ...offers,
    };

    return {
      meta,
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(schema) }],
    };
  },
});
