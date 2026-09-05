import { createFileRoute } from "@tanstack/react-router";
import { ProductDetail } from "@/components/marketplace-home/ProductDetail";
import { getProductSeo } from "@/lib/seo/category-seo";

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
};

const SITE = "https://softwarewala.net";

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
    try {
      const seo = await getProductSeo({ data: { slug: params.slug } });
      if (!seo) return {};
      return {
        name: seo.name,
        description: seo.description,
        keywords: seo.keywords,
        country: seo.country,
        slug: params.slug,
        deployment: seo.deployment,
      };
    } catch (error) {
      console.error("[product head] could not load", params.slug, error);
      return {};
    }
  },

  head: ({ loaderData }) => {
    const data = (loaderData ?? {}) as Loaded;
    if (!data.name) {
      return { meta: [{ title: GENERIC.title }, { name: "description", content: GENERIC.description }] };
    }

    const title = data.country
      ? `${data.name} — ${data.country} | Software Vala`
      : `${data.name} | Software Vala`;
    const description =
      (data.description && data.description.trim()) ||
      (data.country
        ? `${data.name} for businesses in ${data.country}. Live demo, one-time lifetime licence, on Software Vala.`
        : `${data.name} on Software Vala. Live demo and one-time lifetime licence.`);

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

    const canonical = `${SITE}/marketplace/product/${data.slug}`;
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
