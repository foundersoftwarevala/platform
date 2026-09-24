import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ArrowLeft, ExternalLink, Globe2, Layers, MapPin, Package } from "lucide-react";

import { absoluteUrl, siteUrl } from "@/lib/seo/site-url";
import { getCardSlot } from "@/lib/marketplace/card-slot.functions";
import type { CardSlot } from "@/lib/marketplace/card-slot";

/**
 * One card slot: a category in a country, at a URL of its own.
 *
 * A card used to be the product inside it. Its country came from a marker on
 * the product row and its address was that product's slug, so replacing the
 * product replaced the card - a new URL, and every ranking signal the old one
 * had earned went with it. This page belongs to the slot instead: the address,
 * the heading, the description, the country and the category stay put, and the
 * product is drawn as the tenant that currently occupies it.
 *
 * What the slot says about itself is fixed. What it says about a product comes
 * only from the catalogue: no price, feature, rating or claim is invented, and
 * a vacant slot says it is vacant rather than showing a product that is not
 * there.
 *
 * The existing product page is untouched and still serves every product at its
 * own URL; this is the canonical destination for the slot.
 */

type Loaded = { slot: CardSlot | null };

export const Route = createFileRoute("/marketplace/$category/$country")({
  loader: async ({ params }): Promise<Loaded> => {
    try {
      const slot = await getCardSlot({
        data: { category: params.category, country: params.country },
      });
      return { slot };
    } catch (error) {
      console.error("[slot page] could not load", params.category, params.country, error);
      return { slot: null };
    }
  },

  head: ({ loaderData }) => {
    const slot = (loaderData as Loaded | undefined)?.slot ?? null;
    if (!slot) {
      return {
        meta: [
          { title: "Software Vala Marketplace" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }

    const canonical = absoluteUrl(slot.slotUrl);
    const occupied = Boolean(slot.product);

    const meta: Array<Record<string, string>> = [
      { title: slot.metaTitle },
      { name: "description", content: slot.metaDescription },
      { name: "geo.placename", content: slot.country },
      { property: "og:title", content: slot.metaTitle },
      { property: "og:description", content: slot.metaDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: slot.metaTitle },
      { name: "twitter:description", content: slot.metaDescription },
    ];
    if (slot.countryCode) {
      meta.push({ name: "geo.region", content: slot.countryCode });
    }
    if (slot.keywords.length) {
      meta.push({ name: "keywords", content: slot.keywords.join(", ") });
    } else if (slot.primaryKeyword) {
      meta.push({ name: "keywords", content: slot.primaryKeyword });
    }
    // A slot nobody occupies has nothing to rank for yet. It keeps its URL and
    // its links so the grid stays whole, and asks not to be indexed until a
    // real product is in it.
    if (!occupied) {
      meta.push({ name: "robots", content: "noindex, follow" });
    }

    // The same category in every other country. Every one of these slots
    // exists and has a verified ISO country code, and the page is written in
    // English, so the annotation is en-<country> rather than a language this
    // page is not in. x-default points at the category the group belongs to.
    const links: Array<Record<string, string>> = [{ rel: "canonical", href: canonical }];
    for (const sibling of slot.countries) {
      if (!sibling.code) continue;
      links.push({
        rel: "alternate",
        hrefLang: `en-${sibling.code}`,
        href: absoluteUrl(`/marketplace/${slot.categorySlug}/${sibling.slug}`),
      });
    }
    links.push({
      rel: "alternate",
      hrefLang: "x-default",
      href: absoluteUrl(`/marketplace/category/${slot.categorySlug}`),
    });

    const graph: Record<string, unknown>[] = [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Marketplace",
            item: `${siteUrl()}/marketplace`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: slot.categoryName,
            item: absoluteUrl(`/marketplace/category/${slot.categorySlug}`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: slot.country,
            item: absoluteUrl(`/marketplace/country/${slot.countrySlug}`),
          },
          { "@type": "ListItem", position: 4, name: slot.h1, item: canonical },
        ],
      },
    ];

    // SoftwareApplication is a statement about a product, so it is only made
    // when a product is actually here. No rating and no review count is
    // claimed: the catalogue does not record a verified review count, and an
    // invented one is worse than none.
    if (slot.product) {
      const product = slot.product;
      graph.push({
        "@type": "SoftwareApplication",
        name: product.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: product.platform || "Web",
        ...(product.description ? { description: product.description } : {}),
        url: canonical,
        areaServed: { "@type": "Country", name: slot.country },
        brand: { "@type": "Brand", name: "Software Vala" },
        ...(product.features.length ? { featureList: product.features } : {}),
      });
    }

    if (slot.faqs.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: slot.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      });
    }

    return {
      meta,
      links,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
        },
      ],
    };
  },

  component: SlotPage,
});

function SlotPage() {
  const { slot } = useLoaderData({ from: "/marketplace/$category/$country" });
  const { t } = useTranslation();

  if (!slot) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-20 text-center text-white">
        <p className="text-sm text-white/70">{t("marketplace.slot.not_found")}</p>
        <Link to="/marketplace" className="mt-4 inline-block text-sm font-semibold text-cyan-300">
          {t("marketplace.slot.back")}
        </Link>
      </div>
    );
  }

  const product = slot.product;
  const occupiedCountries = slot.countries.filter((c) => c.occupied).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-4">
        <nav
          aria-label={t("marketplace.slot.breadcrumb")}
          className="flex flex-wrap items-center gap-2 text-sm text-white/60"
        >
          <Link to="/marketplace" className="inline-flex items-center gap-2 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            {t("marketplace.slot.marketplace")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            to="/marketplace/category/$slug"
            params={{ slug: slot.categorySlug }}
            className="hover:text-white"
          >
            {slot.categoryName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            to="/marketplace/country/$country"
            params={{ country: slot.countrySlug }}
            className="hover:text-white"
          >
            {slot.country}
          </Link>
        </nav>
      </div>

      <header className="px-6 py-10">
        <p className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {slot.categoryName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {slot.country}
            {slot.region ? ` · ${slot.region}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5" />
            {t("marketplace.slot.card_position", {
              position: slot.slotNo,
              total: slot.countries.length,
            })}
          </span>
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">{slot.h1}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">{slot.metaDescription}</p>
      </header>

      {/* ------------------------------------------------------- the tenant */}
      <section className="px-6 pb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
          {slot.h2s[2] ?? t("marketplace.slot.features_heading")}
        </h2>

        {product ? (
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{product.name}</h3>
                {product.industry && (
                  <p className="mt-1 text-xs text-white/50">{product.industry}</p>
                )}
              </div>
              {product.price && (
                <p className="text-lg font-bold text-cyan-300">
                  {product.price}
                  {product.period && (
                    <span className="ml-1 text-xs font-medium text-white/50">{product.period}</span>
                  )}
                </p>
              )}
            </div>

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-white/75">{product.description}</p>
            )}

            {product.features.length > 0 && (
              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {product.features.map((feature) => (
                  <li key={feature} className="text-sm text-white/70">
                    · {feature}
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 text-xs sm:grid-cols-4">
              {product.platform && (
                <div>
                  <dt className="text-white/45">{t("marketplace.slot.deployment")}</dt>
                  <dd className="mt-0.5 font-semibold text-white/80">{product.platform}</dd>
                </div>
              )}
              {product.license && (
                <div>
                  <dt className="text-white/45">{t("marketplace.slot.licence")}</dt>
                  <dd className="mt-0.5 font-semibold text-white/80">{product.license}</dd>
                </div>
              )}
              {product.subcategory && (
                <div>
                  <dt className="text-white/45">{t("marketplace.slot.type")}</dt>
                  <dd className="mt-0.5 font-semibold text-white/80">{product.subcategory}</dd>
                </div>
              )}
              <div>
                <dt className="text-white/45">{t("marketplace.slot.live_demo")}</dt>
                <dd className="mt-0.5 font-semibold text-white/80">
                  {product.hasDemo
                    ? t("marketplace.slot.demo_available")
                    : t("marketplace.slot.demo_on_request")}
                </dd>
              </div>
            </dl>

            {/* The technology a product is built with is recorded per product
                and only where its author gave one, so nothing is claimed here
                that the catalogue does not hold. */}
            <p className="mt-4 text-[11px] text-white/45">
              {product.tech.length
                ? t("marketplace.slot.technology_listed", { stack: product.tech.join(", ") })
                : t("marketplace.slot.technology_unknown")}
            </p>

            <Link
              to="/marketplace/product/$slug"
              params={{ slug: product.slug }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500/90 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
            >
              {t("marketplace.slot.open_product", { product: product.name })}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </article>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
              <Package className="h-4 w-4 text-white/40" />
              {t("marketplace.slot.vacant_title")}
            </p>
            <p className="mt-2 max-w-xl text-sm text-white/60">
              {t("marketplace.slot.vacant_body", {
                category: slot.categoryName.toLowerCase(),
                country: slot.country,
              })}
            </p>
            <Link
              to="/marketplace/category/$slug"
              params={{ slug: slot.categorySlug }}
              className="mt-4 inline-block text-sm font-semibold text-cyan-300"
            >
              {t("marketplace.slot.see_all_category", { category: slot.categoryName })}
            </Link>
          </div>
        )}
      </section>

      {/* ------------------------------ the same card, in every other country */}
      <section className="border-t border-white/10 px-6 py-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
          {t("marketplace.slot.other_countries", { category: slot.categoryName })}
        </h2>
        <p className="mt-2 text-xs text-white/45">
          {t("marketplace.slot.countries_filled", {
            total: slot.countries.length,
            filled: occupiedCountries,
          })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {slot.countries.map((sibling) => (
            <Link
              key={sibling.marker}
              to="/marketplace/$category/$country"
              params={{ category: slot.categorySlug, country: sibling.slug }}
              className={
                sibling.marker === slot.country
                  ? "rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
                  : "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.08]"
              }
            >
              {sibling.marker}
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------ every other card, in the same country */}
      <section className="border-t border-white/10 px-6 py-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
          {t("marketplace.slot.other_software", { country: slot.country })}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {slot.categories.map((sibling) => (
            <Link
              key={sibling.slug}
              to="/marketplace/$category/$country"
              params={{ category: sibling.slug, country: slot.countrySlug }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.08]"
            >
              {sibling.name}
            </Link>
          ))}
        </div>
        <Link
          to="/marketplace/country/$country"
          params={{ country: slot.countrySlug }}
          className="mt-5 inline-block text-sm font-semibold text-cyan-300"
        >
          {t("marketplace.slot.everything_for", { country: slot.country })}
        </Link>
      </section>

      {slot.faqs.length > 0 && (
        <section className="border-t border-white/10 px-6 py-10">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
            {slot.h2s[7] ?? t("marketplace.slot.faq_heading")}
          </h2>
          <dl className="mt-4 max-w-3xl space-y-5">
            {slot.faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-sm font-bold text-white/90">{faq.question}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-white/70">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
