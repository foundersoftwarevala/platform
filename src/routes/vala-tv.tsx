import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo/site-url";
import { useMemo, useState } from "react";
import { Play, Video } from "lucide-react";
import { embedUrl, hasPlayableVideo, VIDEO_CATEGORIES } from "@/lib/site-content/videos";
import { getStorefrontChrome, type StorefrontVideo } from "@/lib/storefront/chrome.functions";
import CategoryRow from "@/components/marketplace-home/CategoryRow";
import { SiteFooter } from "@/components/marketplace-home/SiteFooter";
import { RAIL_COUNTRIES } from "@/lib/marketplace/rail-countries";
import { useTranslation } from "@/lib/i18n/use-translation";
import "@/styles/marketplace-home.css";

/**
 * The full Vala TV listing. Videos are managed from
 * Marketplace Manager -> Growth -> Vala TV; this page shows whatever is
 * published there and says plainly when a film has no URL set yet rather than
 * opening something unrelated.
 *
 * It used to read a browser-side store, so a film published in the manager
 * reached the home page - which asks the server - and never reached this page.
 * Both now read the same published rows.
 *
 * The films are laid out as horizontal rows rather than a grid, the same
 * CategoryRow the marketplace uses above, because the channel is being built
 * out to eighty films - one for each country in the owner's published
 * geographic batch - and eighty cards in a grid is a page nobody scrolls to
 * the bottom of.
 *
 * Each film carries the one country it is placed in, which is what the rows are
 * grouped by: a region row gathers the films placed in that part of the world.
 * That is the same geography the SEO text on each film was written for, so what
 * a visitor sees and what a search engine reads agree with each other.
 */

/** Country label -> the region a reader would name, from the published batch. */
const REGION_OF = new Map(RAIL_COUNTRIES.map((c) => [c.label, c.region]));

/** The region order the marketplace already uses, so rows do not jump about. */
const REGION_ORDER = (() => {
  const seen: string[] = [];
  for (const country of RAIL_COUNTRIES) {
    if (!seen.includes(country.region)) seen.push(country.region);
  }
  return seen;
})();

type Film = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  views: string;
  category: string;
  country: string;
  region: string;
};

function ValaTvPage() {
  const { t } = useTranslation();
  const { videos: published, channel } = Route.useLoaderData();

  const films: Film[] = useMemo(
    () =>
      published.map((video: StorefrontVideo) => ({
        id: video.id,
        title: video.title,
        url: video.url ?? "",
        thumbnail: video.thumbnail ?? "",
        duration: video.duration ?? "",
        views: video.views == null ? "" : String(video.views),
        category: video.category ?? "",
        country: video.country ?? "",
        region: (video.country && REGION_OF.get(video.country)) || "",
      })),
    [published],
  );

  const [filter, setFilter] = useState<string>("All");
  const [playing, setPlaying] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...VIDEO_CATEGORIES.filter((c) => films.some((v) => v.category === c))],
    [films],
  );
  const shown = filter === "All" ? films : films.filter((v) => v.category === filter);

  /**
   * The rows: the newest films first, then one row per region that has any.
   * A film with no country yet still appears - in "More films" - because a film
   * nobody has placed is still a film, and dropping it would be worse than
   * showing it without a region.
   */
  const rows = useMemo(() => {
    const out: { key: string; title: string; films: Film[] }[] = [];
    if (shown.length > 1) {
      out.push({ key: "latest", title: "Latest films", films: shown.slice(0, 20) });
    }
    for (const region of REGION_ORDER) {
      const inRegion = shown.filter((f) => f.region === region);
      if (inRegion.length > 0) out.push({ key: region, title: region, films: inRegion });
    }
    const unplaced = shown.filter((f) => !f.region);
    if (unplaced.length > 0) out.push({ key: "more", title: "More films", films: unplaced });
    return out;
  }, [shown]);

  const card = (video: Film) => {
    const playable = hasPlayableVideo(video.url);
    return (
      <article
        key={video.id}
        className="w-[272px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:w-[300px]"
      >
        <div className="relative aspect-video bg-black/40">
          {playing === video.id && playable ? (
            <iframe
              src={embedUrl(video.url)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <>
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10">
                  <Video className="h-8 w-8 text-white/25" aria-hidden="true" />
                </div>
              )}
              {playable ? (
                <button
                  type="button"
                  onClick={() => setPlaying(video.id)}
                  aria-label={`Play ${video.title}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900">
                    <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-center text-[11px] text-white/70">
                  {t("marketplace.home.film_unpublished")}
                </span>
              )}
            </>
          )}
          {video.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold">
              {video.duration}
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {video.category && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                {video.category}
              </span>
            )}
            {video.country && (
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                {video.country}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-sm font-bold leading-snug">{video.title}</h2>
          {video.views && (
            <p className="mt-1 text-[11px] text-white/50">
              {t("marketplace.home.views_count", { views: video.views })}
            </p>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="sv-wide min-h-screen bg-[#050b18] text-white">
      <main className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            {t("marketplace.valatv.back")}
          </a>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vala TV</h1>
              <p className="mt-1.5 text-sm text-white/60">{t("marketplace.valatv.subtitle")}</p>
            </div>
            {channel && (
              <a
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-[13px] font-semibold text-red-200 transition-colors hover:bg-red-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                {t("marketplace.valatv.channel")}
              </a>
            )}
          </div>

          {films.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/60">
              {t("marketplace.valatv.empty")}
              {channel && (
                <>
                  {" "}
                  The channel itself is at{" "}
                  <a
                    href={channel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                  >
                    YouTube
                  </a>
                  .
                </>
              )}
            </p>
          ) : (
            <>
              {categories.length > 1 && (
                <div
                  className="mt-6 flex flex-wrap gap-2"
                  role="tablist"
                  aria-label={t("marketplace.valatv.categories_label")}
                >
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={filter === category}
                      onClick={() => setFilter(category)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        filter === category
                          ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                          : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}

              {shown.length === 0 ? (
                <p className="mt-10 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-sm text-white/60">
                  {t("marketplace.valatv.category_empty")}
                </p>
              ) : (
                <div className="mt-8">
                  {rows.map((row) => (
                    <CategoryRow
                      key={row.key}
                      title={row.title}
                      count={row.films.length}
                      unit={row.films.length === 1 ? "Film" : "Films"}
                    >
                      {row.films.map(card)}
                    </CategoryRow>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/vala-tv")({
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/vala-tv") }],
    meta: [
      { title: "Vala TV | Software Vala" },
      {
        name: "description",
        content:
          "Product demos, walkthroughs and customer films from the Software Vala marketplace.",
      },
      { property: "og:title", content: "Vala TV | Software Vala" },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: async () => {
    const chrome = await getStorefrontChrome();
    // The channel comes from storefront_social_links, where the business
    // already records it and where the footer already reads it, so there is
    // one answer to "which channel is ours" rather than a second copy here.
    const youtube = (chrome.footer?.socials ?? []).find(
      (s) => String(s.label).toLowerCase() === "youtube",
    );
    return { videos: chrome.videos, channel: youtube?.href ?? null };
  },
  component: ValaTvPage,
});
