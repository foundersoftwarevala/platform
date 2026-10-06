import { createFileRoute, notFound } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/seo/site-url";
import { ProductDetail, ProductNotFound } from "@/components/marketplace-home/ProductDetail";
import { getSeoOverride } from "@/lib/seo/page-overrides.functions";
import { getProductSeo } from "@/lib/seo/category-seo";
import { getPublicProduct } from "@/lib/marketplace.functions";
import { canIndexPage } from "@/lib/seo/sitemap-gate";

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
  /** Both lookups succeeded and found nothing: there is no such product. */
  missing?: boolean;
  deployment?: string | null;
  /** What the SEO Manager says about this page, when it has been given a record. */
  override?: import("@/lib/seo/page-overrides").SeoOverride | null;
  /** The central SEO gate controls both robots and the product sitemap. */
  indexable?: boolean;
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
  component: () => (
    <>
      <ProductDetail />
      {/* Without this, every message this page tries to show is invisible. */}
      <Toaster />
    </>
  ),
  // Drawn when the loader throws notFound() for a slug with no product.
  notFoundComponent: function ProductRouteNotFound() {
    const { slug } = Route.useParams();
    return <ProductNotFound slug={slug} />;
  },

  loader: async ({ params }): Promise<Loaded> => {
    // The product and its SEO are unrelated lookups, so one failing must not
    // cost the other. Settled, not all.
    const [seoResult, productResult, gateResult] = await Promise.allSettled([
      getProductSeo({ data: { slug: params.slug } }),
      getPublicProduct({ data: { slug: params.slug } }),
      canIndexPage({ url: `/marketplace/product/${params.slug}` }),
    ]);
    const indexable = gateResult.status === "fulfilled" && gateResult.value.indexable;
    const product = productResult.status === "fulfilled" ? productResult.value : null;
    /**
     * Both lookups worked and neither found anything: there is no such product.
     *
     * /marketplace/product/<anything> answered 200 with a title and no robots
     * tag, so every wrong or stale slug was an indexable page. This is not the
     * same as a lookup that failed, which must keep the page's identity - the
     * difference is fulfilled-but-empty.
     */
    const missing =
      productResult.status === "fulfilled" &&
      // getPublicProduct always resolves to an object and puts the absence in
      // `product: null`, so testing the result itself is always truthy - which
      // is why the first version of this never fired.
      !productResult.value?.product &&
      seoResult.status === "fulfilled" &&
      !seoResult.value;
    // noindex alone left it a 200 - a soft 404. Setting the status by hand
    // (respondNotFound) did not help either: the SSR renderer answers with the
    // router's own status code, which only notFound() changes. Throwing it
    // makes the response a real 404, and notFoundComponent below draws the
    // page's own "Product Not Found" screen, so what a visitor sees is unchanged.
    if (missing) throw notFound();
    try {
      const seo = seoResult.status === "fulfilled" ? seoResult.value : null;
      if (!seo) {
        // A product the page body found without a catalogue SEO row - one of
        // the marketplace's own listed demos - is named for what it is. It
        // used to share one generic title, with no canonical, across every
        // such page.
        const shown = (
          product as {
            product?: {
              name?: string;
              description?: string | null;
              industry_label?: string | null;
            } | null;
          } | null
        )?.product;
        if (shown?.name) {
          return {
            name: shown.name,
            description: shown.description ?? shown.industry_label ?? null,
            slug: params.slug,
            product,
            indexable,
          };
        }
        return { product, missing, indexable };
      }
      // What the SEO Manager says about this page, if anything. A record it has
      // never been given simply resolves to null and the product speaks for
      // itself, exactly as before.
      const override = await getSeoOverride({
        data: {
          path: `/marketplace/product/${params.slug}`,
          variables: {
            page_name: seo.name,
            title: seo.name,
            product: seo.name,
            country: seo.country ?? undefined,
            industry: seo.deployment ?? undefined,
            excerpt: seo.description ?? undefined,
          },
        },
      });
      return {
        name: seo.name,
        description: seo.description,
        keywords: seo.keywords,
        country: seo.country,
        slug: params.slug,
        deployment: seo.deployment,
        override,
        product,
        indexable,
      };
    } catch (error) {
      console.error("[product head] could not load", params.slug, error);
      return { product, missing, indexable: false };
    }
  },

  head: ({ loaderData, match }) => {
    const data = { ...((loaderData ?? {}) as Loaded) };
    // A thrown notFound() leaves no loader data; the match says why.
    if ((match as { status?: string } | undefined)?.status === "notFound") data.missing = true;
    if (!data.name) {
      const meta: Record<string, string>[] = [
        { title: data.missing ? "Product not found | Software Vala" : GENERIC.title },
        { name: "description", content: GENERIC.description },
      ];
      if (!data.missing) {
        if (data.indexable !== true) meta.push({ name: "robots", content: "noindex, follow" });
        return { meta };
      }
      // No such product. The page still renders, so a stale link is not a dead
      // end, but it is kept out of the index and points at the marketplace
      // rather than claiming to be a product of its own.
      meta.push({ name: "robots", content: "noindex, follow" });
      return { meta, links: [{ rel: "canonical", href: `${siteUrl()}/marketplace` }] };
    }

    const override = data.override ?? null;

    // The country is appended only where the name does not already say it.
    // The geographic batch names a card after its country - "Healthcare
    // Software — Taiwan" - and appending again read "Taiwan — Taiwan", which
    // is a duplicate title on the page and in the search result. Every name
    // that does not carry its country is unaffected.
    const namesItsCountry = Boolean(
      data.country && data.name.toLowerCase().includes(data.country.toLowerCase()),
    );
    const defaultTitle =
      data.country && !namesItsCountry
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
    if (data.indexable !== true || override?.noindex) {
      meta.push({ name: "robots", content: "noindex, follow" });
    }
    // og:url names the page a share points at; it was missing on every product.
    meta.push({ property: "og:url", content: canonical });
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
