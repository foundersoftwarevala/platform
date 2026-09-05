import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useLoaderData, useParams } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import { absoluteUrl } from "@/lib/seo/site-url";
import {
  getCountryProducts,
  getCountrySeo,
  type CountryCard,
  type CountrySeo,
} from "@/lib/seo/country-seo";

/**
 * Everything the catalogue holds for one country.
 *
 * Each product is written for a country, but that only ever appeared inside the
 * product's own title, so there was no page for someone searching from Kenya or
 * the UAE to land on and nothing for a crawler to follow from a country search
 * into the catalogue. Each of the sixty countries carries around ninety
 * products across most of the categories, so there is real depth behind these.
 *
 * The first page of products is rendered with the document, so the links are in
 * the HTML rather than appearing after it loads; the rest arrive as the reader
 * reaches the bottom.
 */

type Loaded = {
  seo: CountrySeo | null;
  cards: CountryCard[];
  total: number;
  hasMore: boolean;
};

const PAGE = 24;

export const Route = createFileRoute("/marketplace/country/$country")({
  loader: async ({ params }): Promise<Loaded> => {
    try {
      const seo = await getCountrySeo({ data: { slug: params.country } });
      if (!seo) return { seo: null, cards: [], total: 0, hasMore: false };

      // The first page is fetched on the server rather than in the browser, so
      // the document itself carries the product links.
      const { cards, total } = await getCountryProducts({
        data: { slug: params.country, offset: 0, limit: PAGE },
      });
      return { seo, cards, total, hasMore: cards.length < total };
    } catch (error) {
      console.error("[country page] could not load", params.country, error);
      return { seo: null, cards: [], total: 0, hasMore: false };
    }
  },

  head: ({ loaderData }) => {
    const data = (loaderData ?? {}) as Loaded;
    const seo = data.seo;
    if (!seo) {
      return {
        meta: [
          { title: "Country — Software Vala Marketplace" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const top = seo.categories.slice(0, 6).map((c) => c.name);
    const title = `Software for ${seo.country} — ${seo.productCount} Ready-to-Deploy Solutions | Software Vala`;
    const description =
      `Browse ${seo.productCount} software solutions built for businesses in ${seo.country}` +
      (top.length ? `, across ${top.join(", ")} and more.` : ".") +
      " One-time price, full source code, live demo on request.";
    const canonical = absoluteUrl(`/marketplace/country/${seo.slug}`);

    return {
      links: [{ rel: "canonical", href: canonical }],
      meta: [
        { title },
        { name: "description", content: description },
        { name: "geo.placename", content: seo.country },
        {
          name: "keywords",
          content: [
            `software ${seo.country}`,
            `best software ${seo.country}`,
            `buy software ${seo.country}`,
            `software price ${seo.country}`,
            `ready made software ${seo.country}`,
            `software with source code ${seo.country}`,
            ...top.map((c) => `${c.toLowerCase()} software ${seo.country}`),
          ].join(", "),
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: canonical,
            about: { "@type": "Country", name: seo.country },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: seo.productCount,
              itemListElement: data.cards.slice(0, 20).map((card, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: absoluteUrl(card.href),
                name: card.name,
              })),
            },
          }),
        },
      ],
    };
  },

  component: CountryPage,
});

function CountryPage() {
  const { country } = useParams({ from: "/marketplace/country/$country" });
  const loaded = useLoaderData({ from: "/marketplace/country/$country" });
  const [cards, setCards] = useState<CountryCard[]>(loaded.cards);
  const [hasMore, setHasMore] = useState(loaded.hasMore);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const more = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/marketplace/country?country=${encodeURIComponent(country)}` +
          `&offset=${cards.length}&limit=${PAGE}`,
      );
      const data = await response.json();
      if (response.ok) {
        setCards((current) => [...current, ...(data.cards ?? [])]);
        setHasMore(Boolean(data.hasMore));
      }
    } catch {
      // leave what is already on screen; the button stays for another try
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) void more();
      },
      { rootMargin: "500px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, cards.length]);

  if (!loaded.seo) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-20 text-center">
        <p className="text-sm text-white/70">
          The catalogue does not target that country.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-cyan-300">
          Back to the marketplace
        </Link>
      </div>
    );
  }

  const seo = loaded.seo;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>

      <header className="px-6 py-10">
        <h1 className="text-3xl font-black sm:text-4xl">Software for {seo.country}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">
          {seo.productCount} solutions in the catalogue are written for {seo.country},
          across {seo.categories.length} categories. One-time price, full source code,
          and a live demo once you are signed in.
        </p>
      </header>

      {seo.categories.length > 0 && (
        <section className="px-6 pb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
            Categories covered in {seo.country}
          </h2>
          <div className="flex flex-wrap gap-2">
            {seo.categories.map((category) => (
              <Link
                key={category.id}
                to="/marketplace/category/$slug"
                params={{ slug: category.slug }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/85 hover:bg-white/[0.08]"
              >
                {category.name}
                <span className="ml-2 text-xs text-white/45">{category.productCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 pb-16">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/50">
          {seo.productCount} solutions for {seo.country}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.id}
              to="/marketplace/product/$slug"
              params={{ slug: card.slug }}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              <Package className="h-6 w-6 text-white/40" aria-hidden="true" />
              <span className="mt-3 text-base font-bold">{card.name}</span>
              {card.industry && (
                <span className="mt-1 text-xs text-white/50">{card.industry}</span>
              )}
              {card.price && (
                <span className="mt-3 text-sm font-semibold text-white/80">{card.price}</span>
              )}
            </Link>
          ))}
        </div>

        {hasMore && (
          <div ref={sentinel} className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => void more()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/85 hover:bg-white/[0.08] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Loading" : `Show more (${seo.productCount - cards.length} left)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
