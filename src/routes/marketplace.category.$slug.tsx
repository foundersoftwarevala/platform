import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { siteUrl } from "@/lib/seo/site-url";
import { CategoryDetail, CategoryNotFound } from "@/components/marketplace-home/CategoryDetail";
import { getPublicProductsByCategory } from "@/lib/marketplace.functions";
import { getCategorySeo, type CategorySeo } from "@/lib/seo/category-seo";

/**
 * Every category page used to send the same title and description, so all 91 of
 * them looked like one page to a search engine. Each now describes its own
 * category, names the countries it is targeted at, and carries the keyword plan
 * held in the SEO manager, plus a canonical URL and CollectionPage data.
 *
 * If the category cannot be loaded the page still renders with the generic copy
 * rather than the route failing.
 */



const GENERIC = {
  title: "Category — Software Vala Marketplace",
  description: "Browse products by category on the Software Vala marketplace.",
};

/** "USA, UAE, Canada and 57 more" — readable, and honest about the count. */
function countryPhrase(countries: string[]): string {
  const unique = Array.from(new Set(countries));
  if (!unique.length) return "";
  const lead = unique.slice(0, 3).join(", ");
  const rest = unique.length - 3;
  return rest > 0 ? `${lead} and ${rest} more countries` : lead;
}

function CategoryNotFoundPage() {
  const { slug } = useParams({ from: "/marketplace/category/$slug" });
  return <CategoryNotFound slug={slug} />;
}

export const Route = createFileRoute("/marketplace/category/$slug")({
  component: CategoryDetail,
  // The same "Category Not Found" card the page has always drawn, now rendered
  // for a real 404 instead of inside a 200.
  notFoundComponent: CategoryNotFoundPage,

  /**
   * The SEO and the products are separate lookups, so one failing must not cost
   * the other. The products are fetched here so the page renders on the server
   * instead of shipping a spinner to a search engine.
   */
  loader: async ({ params }): Promise<{ seo: CategorySeo | null; products: unknown }> => {
    const [seo, products] = await Promise.allSettled([
      getCategorySeo({ data: { slug: params.slug } }),
      getPublicProductsByCategory({ data: { category_slug: params.slug } }),
    ]);
    if (seo.status === "rejected") {
      console.error("[category head] could not load", params.slug, seo.reason);
    }
    // A mistyped or hidden category used to answer 200. Only a catalogue that
    // answered "no such public category" sets `not_found`; a lookup that failed
    // leaves it unset and the page renders exactly as before.
    // Typed explicitly for the same reason as the product route: the server
    // function's inferred return type collapses to {}.
    if (
      products.status === "fulfilled" &&
      (products.value as { not_found?: boolean } | null)?.not_found
    ) {
      throw notFound();
    }
    return {
      seo: seo.status === "fulfilled" ? seo.value : null,
      products: products.status === "fulfilled" ? products.value : null,
    };
  },

  head: ({ loaderData, params, match }) => {
    // The loader answered 404 and left no loader data; keep the page out of
    // the index rather than falling through to the generic, indexable copy.
    if (match.status === "notFound") {
      return {
        meta: [
          { title: "Category not found — Software Vala" },
          { name: "description", content: GENERIC.description },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const data = (loaderData as { seo?: CategorySeo | null } | null)?.seo ?? null;
    const listing = (loaderData as {
      products?: { category?: unknown; products?: { slug?: string; name?: string }[] } | null;
    } | null)?.products;

    // The catalogue answered and there is no such category (or it is hidden).
    // This page used to be a 200 with a generic title and nothing telling a
    // search engine to leave it out - a soft 404 for every mistyped slug. It is
    // now marked noindex. A catalogue that could not be read at all (listing
    // null) is not treated as missing.
    if (listing && !listing.category) {
      return {
        meta: [
          { title: "Category not found — Software Vala" },
          { name: "description", content: GENERIC.description },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }

    if (!data) {
      return {
        meta: [{ title: GENERIC.title }, { name: "description", content: GENERIC.description }],
      };
    }

    const countries = countryPhrase(data.countries);
    const count = data.productCount;

    const title =
      data.title ??
      (count > 0
        ? `${data.name} Software — ${count} Ready-to-Deploy Solutions | Software Vala`
        : `${data.name} Software | Software Vala`);

    const description =
      data.description ??
      [
        count > 0
          ? `Browse ${count} ready-to-deploy ${data.name.toLowerCase()} software solutions on Software Vala.`
          : `Browse ${data.name.toLowerCase()} software solutions on Software Vala.`,
        countries ? `Serving businesses in ${countries}.` : "",
        "Live demo before you buy, one-time lifetime licence.",
      ]
        .filter(Boolean)
        .join(" ");

    const canonical = `${siteUrl()}/marketplace/category/${params.slug}`;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (data.keywords.length) {
      meta.push({ name: "keywords", content: data.keywords.join(", ") });
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description,
      url: canonical,
      isPartOf: { "@type": "WebSite", name: "Software Vala", url: siteUrl() },
      ...(count > 0
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: count,
              name: `${data.name} software`,
              // The products on the page, by address, so the list points
              // somewhere rather than only stating a number.
              ...(listing?.products?.length
                ? {
                    itemListElement: listing.products
                      .filter((p) => p.slug)
                      .slice(0, 50)
                      .map((p, index) => ({
                        "@type": "ListItem",
                        position: index + 1,
                        url: `${siteUrl()}/marketplace/product/${p.slug}`,
                        name: p.name,
                      })),
                  }
                : {}),
            },
          }
        : {}),
    };

    return {
      meta,
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(schema) }],
    };
  },
});
