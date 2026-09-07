import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, GraduationCap, Hospital, Hotel, ShoppingBag, Wrench, Factory,
  Trophy, Award, BookOpen, Handshake, ChevronRight, Star,
  Activity, Download, ShoppingCart, Brain, Bot, Search as SearchIcon,
  Zap, ShieldCheck, Globe2, Building2, ArrowRight, Quote, Play, HelpCircle,
} from "lucide-react";

import { LIFETIME_PRICE, SITE_STATS } from "@/lib/site-content/constants";
import { listPublishedFaqs } from "@/lib/site-content/faq";
import { embedUrl, hasPlayableVideo, listPublishedVideos } from "@/lib/site-content/videos";
import { listCourses } from "@/lib/site-content/academy";
import { listAwards } from "@/lib/site-content/awards";
import { listStories } from "@/lib/site-content/stories";
import { useMatch } from "@tanstack/react-router";

const sectionTitle = (title: string, href?: string, subtitle?: string) => (
  <div className="mb-5 flex items-end justify-between px-6">
    <div>
      <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight text-white lg:text-2xl">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-fuchsia-500 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
        <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">{title}</span>
      </h2>
      {subtitle && <p className="mt-1 pl-4 text-xs text-white/60">{subtitle}</p>}
    </div>
    {href && (
      <a href={href} className="group flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
        View all <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>
    )}
  </div>
);

// Shop by Industry
// Each tile opens the real category page rather than an in-page anchor.
const INDUSTRIES = [
  { name: "Education", href: "/marketplace/category/education", icon: GraduationCap, color: "from-cyan-500/20 to-blue-500/10", text: "text-cyan-300", count: 24 },
  { name: "Healthcare", href: "/marketplace/category/healthcare", icon: Hospital, color: "from-rose-500/20 to-pink-500/10", text: "text-rose-300", count: 18 },
  { name: "Hospitality", href: "/marketplace/category/hospitality", icon: Hotel, color: "from-amber-500/20 to-orange-500/10", text: "text-amber-300", count: 12 },
  { name: "E-commerce", href: "/marketplace/category/ecommerce", icon: ShoppingBag, color: "from-fuchsia-500/20 to-purple-500/10", text: "text-fuchsia-300", count: 15 },
  { name: "Services", href: "/marketplace/category/customer-support-helpdesk", icon: Wrench, color: "from-emerald-500/20 to-teal-500/10", text: "text-emerald-300", count: 22 },
  { name: "Manufacturing", href: "/marketplace/category/manufacturing", icon: Factory, color: "from-violet-500/20 to-indigo-500/10", text: "text-violet-300", count: 14 },
];

/**
 * The industries to show.
 *
 * Featured categories, in the manager's order, with their real product counts.
 * Falls back to the six written above when the request fails or returns
 * nothing — the grid must not disappear because a lookup did.
 */
function useIndustries() {
  const [rows, setRows] = useState<typeof INDUSTRIES | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/marketplace/rows");
        if (!response.ok) return;
        const data = (await response.json()) as {
          rows?: {
            title?: string; href?: string; products?: number;
            featured?: boolean; hidden?: boolean;
          }[];
        };
        const featured = (data.rows ?? [])
          .filter((r) => r.featured && !r.hidden && r.title && r.href)
          .slice(0, 6)
          .map((r, index) => ({
            name: String(r.title),
            href: String(r.href),
            // The palette is kept by position, so the section looks unchanged.
            icon: INDUSTRIES[index % INDUSTRIES.length]!.icon,
            color: INDUSTRIES[index % INDUSTRIES.length]!.color,
            text: INDUSTRIES[index % INDUSTRIES.length]!.text,
            count: Number(r.products ?? 0),
          }));
        if (!cancelled && featured.length > 0) setRows(featured);
      } catch {
        /* keep the built-in six */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The second value says whether these counts came from the catalogue.
  return { items: rows ?? INDUSTRIES, countsAreReal: rows !== null };
}

export const IndustryGrid = () => {
  const { items: industries, countsAreReal } = useIndustries();
  return (
  <section className="pt-2 pb-6">
    {sectionTitle("Shop by Industry", "/marketplace", "Pre-built suites for every sector")}
    <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
      {industries.map((i) => (
        <a key={i.name} href={i.href} aria-label={`Browse ${i.name} software`} className={`group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br ${i.color} p-4 transition-colors hover:border-cyan-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 motion-safe:transition-all motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_18px_40px_-18px_rgba(34,211,238,0.5)]`}>
          <i.icon className={`h-7 w-7 ${i.text}`} />
          <div className="mt-3 text-sm font-bold text-white">{i.name}</div>
          {countsAreReal && (
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/60">{i.count} products</div>
          )}
        </a>
      ))}
    </div>
  </section>
  );
};

// AI Zone
// Each tool opens a real page that searches the live catalogue.
const AI_TOOLS = [
  { name: "AI Product Finder", href: "/ai/finder", desc: "Describe your need, get the perfect stack.", icon: SearchIcon, accent: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  { name: "AI Recommendation", href: "/ai/recommend", desc: `Personalised picks from ${SITE_STATS.solutions} products.`, icon: Sparkles, accent: "text-cyan-300", ring: "border-cyan-400/30" },
  { name: "AI Compare", href: "/ai/compare", desc: "Side-by-side feature & price intelligence.", icon: Brain, accent: "text-violet-300", ring: "border-violet-400/30" },
  { name: "AI Sales Assistant", href: "/ai/assistant", desc: "Answers from the live catalogue for buyers & vendors.", icon: Bot, accent: "text-emerald-300", ring: "border-emerald-400/30" },
];

export const AIZone = () => (
  <section className="py-10">
    {sectionTitle("AI Zone", "/marketplace", "Automation copilots built into the marketplace")}
    <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
      {AI_TOOLS.map((t) => (
        <a
          key={t.name}
          href={t.href}
          aria-label={`Open ${t.name}`}
          className={`group relative overflow-hidden rounded-2xl border ${t.ring} bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 motion-safe:transition-all motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_24px_60px_-20px_rgba(217,70,239,0.45)]`}
        >
          <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ${t.accent}`}>
            <t.icon className="h-5 w-5" />
          </div>
          <div className="text-sm font-bold text-white">{t.name}</div>
          <p className="mt-1 text-xs text-white/60">{t.desc}</p>
          <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
            Open tool <ArrowRight className="h-3 w-3" />
          </div>
        </a>
      ))}
    </div>
  </section>
);

// Success Stories — content lives in @/lib/site-content/stories so these can
// be swapped for real marketplace records without changing this component.

type PublishedStory = {
  id: string; company: string; quote: string; author: string; role: string;
  metric: string; metric_label: string; product: string; product_slug: string | null;
};
type PublishedAward = {
  id: string; category: string; winner: string; product_slug: string | null; year: number;
};

/**
 * The stories and awards an operator has published.
 *
 * Both of these sections drew a list written into the source: named companies,
 * named people and figures nobody ever gave. One of the names is a real
 * healthcare brand. They read the database now, and when nothing is published
 * the sections draw nothing at all. The written lists are left in the codebase,
 * unused, rather than removed.
 */
function usePublishedProof() {
  const [proof, setProof] = useState<{ stories: PublishedStory[]; awards: PublishedAward[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/marketplace/proof");
        const data = await response.json();
        if (!cancelled) {
          setProof({
            stories: Array.isArray(data?.stories) ? data.stories : [],
            awards: Array.isArray(data?.awards) ? data.awards : [],
          });
        }
      } catch {
        if (!cancelled) setProof({ stories: [], awards: [] });
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return proof;
}

export const SuccessStories = () => {
  const proof = usePublishedProof();
  if (!proof || proof.stories.length === 0) return null;
  return (
  <section className="py-10">
    {sectionTitle("Success Stories", "/marketplace", "How businesses are running on Software Vala")}
    <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
      {proof.stories.map((s) => (
        <article
          key={s.company}
          className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6"
        >
          <Quote className="absolute right-4 top-4 h-8 w-8 text-cyan-400/20" aria-hidden="true" />
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{s.company}</div>
          <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-white/85">
            &ldquo;{s.quote}&rdquo;
          </blockquote>
          <div className="mt-4 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-white/80">{s.author}</div>
                <div className="truncate text-[11px] text-white/50">{s.role}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-bold text-emerald-300">{s.metric}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">{s.metric_label}</div>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-white/50">
              Product:{" "}
              {s.product_slug ? (
                <a
                  href={`/marketplace/product/${s.product_slug}`}
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {s.product}
                </a>
              ) : (
                <span className="font-semibold text-white/70">{s.product}</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  </section>
  );
};

// Awards & Champions — the winners live in @/lib/site-content/awards; only the
// styling for each category stays here.
const AWARD_STYLE: Record<string, { icon: typeof Trophy; color: string; ring: string }> = {
  "Vendor of the Year": { icon: Trophy, color: "text-amber-300", ring: "border-amber-400/30" },
  "Fastest Growing App": { icon: Zap, color: "text-cyan-300", ring: "border-cyan-400/30" },
  "Editor's Choice": { icon: Award, color: "text-fuchsia-300", ring: "border-fuchsia-400/30" },
  "Most Loved by Users": { icon: Star, color: "text-rose-300", ring: "border-rose-400/30" },
};
const AWARD_FALLBACK = { icon: Trophy, color: "text-amber-300", ring: "border-amber-400/30" };

export const AwardsRow = () => {
  const proof = usePublishedProof();
  if (!proof || proof.awards.length === 0) return null;
  return (
  <section className="py-10">
    {sectionTitle("Awards & Champions", "/marketplace", "Recognised across the marketplace")}
    <ul className="grid grid-cols-2 gap-4 px-6 lg:grid-cols-4">
      {proof.awards.map((a) => {
        const style = AWARD_STYLE[a.category] ?? AWARD_FALLBACK;
        const Icon = style.icon;
        // A winner only becomes a link when it is a real listing.
        const body = (
          <>
            <Icon className={`h-7 w-7 ${style.color}`} aria-hidden="true" />
            <div className="mt-3 text-[11px] uppercase tracking-wider text-white/60">{a.category}</div>
            <div className="mt-1 text-base font-bold text-white">{a.winner}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{a.year}</div>
          </>
        );
        return (
          <li key={a.category}>
            {a.product_slug ? (
              <a
                href={`/marketplace/product/${a.product_slug}`}
                className={`block rounded-2xl border ${style.ring} bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400`}
              >
                {body}
              </a>
            ) : (
              <div className={`rounded-2xl border ${style.ring} bg-white/[0.03] p-5`}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  </section>
  );
};

// Live Activity
const seedEvents = () => [
  { icon: ShoppingCart, label: "purchased", text: "ShopEngine — Lifetime", who: "Acme Retail", city: "Mumbai", color: "text-emerald-300" },
  { icon: Download, label: "downloaded", text: "EduFlow Pro v4.2", who: "GreenLeaf Schools", city: "Pune", color: "text-cyan-300" },
  { icon: Star, label: "reviewed", text: "MediCore 360 — 5★", who: "Dr. Neha R.", city: "Bengaluru", color: "text-amber-300" },
  { icon: Sparkles, label: "released", text: "HotelNest v3.0", who: "HotelNest Team", city: "Goa", color: "text-fuchsia-300" },
  { icon: Activity, label: "renewed", text: "FactoryOS Annual", who: "Steel Works Pvt", city: "Chennai", color: "text-violet-300" },
];

/** Which icon and colour a real event kind is drawn with. */
const EVENT_STYLE: Record<string, { icon: typeof Activity; color: string }> = {
  purchase: { icon: ShoppingCart, color: "text-emerald-300" },
  product_view: { icon: Activity, color: "text-cyan-300" },
  demo_open: { icon: Play, color: "text-fuchsia-300" },
  download: { icon: Download, color: "text-cyan-300" },
  review: { icon: Star, color: "text-amber-300" },
  release: { icon: Sparkles, color: "text-fuchsia-300" },
};

type MarketplaceEvent = {
  id: string;
  kind: string;
  label: string;
  product: string;
  at: string;
};

/** "3 minutes ago", from the time the event was actually recorded. */
function whenAgo(at: string): string {
  const then = new Date(at).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/**
 * What is really happening in the marketplace.
 *
 * This drew five invented purchases - named companies in named cities that do
 * not exist - and rotated them on a timer so they looked like a live feed.
 * Invented social proof is not something this business is willing to show, and
 * the events endpoint that carries the real ones was already built and going
 * unused. It reads that now. When there is nothing to report it says so
 * plainly rather than filling the space with something untrue.
 *
 * `seedEvents` above is left in place, unused, rather than removed.
 */
export const LiveActivity = () => {
  const [items, setItems] = useState<MarketplaceEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const response = await fetch("/api/marketplace/activity");
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as { events?: MarketplaceEvent[] };
        if (!cancelled) setItems(Array.isArray(data.events) ? data.events.slice(0, 8) : []);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    void read();
    // The feed refreshes on its own, but from the database rather than by
    // shuffling the same five rows around.
    const timer = setInterval(read, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="py-10">
      {sectionTitle("Live Marketplace Activity", undefined, "Real views, demo opens and purchases across the catalogue")}
      <div className="mx-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent">
        {items === null && (
          <p className="px-5 py-6 text-sm text-white/60">Reading the marketplace…</p>
        )}
        {items !== null && items.length === 0 && (
          <p className="px-5 py-6 text-sm text-white/60">
            Nothing has happened in the marketplace just yet.
          </p>
        )}
        {items !== null && items.length > 0 && (
          <ul>
            {items.map((event) => {
              const style = EVENT_STYLE[event.kind] ?? { icon: Activity, color: "text-white/70" };
              const Icon = style.icon;
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 border-b border-white/5 px-5 py-3 text-sm transition-colors hover:bg-white/[0.03] last:border-0 animate-in fade-in slide-in-from-top-1 duration-500"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 ${style.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-white/85">
                    Someone {event.label}{" "}
                    <span className="font-medium text-white">{event.product}</span>
                  </span>
                  <span className="ml-auto text-[11px] text-white/60">{whenAgo(event.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

/**
 * Published Vala TV videos, from the database.
 *
 * This used to read a client-side store seeded with six videos that all
 * pointed at the same placeholder YouTube id and carried invented view counts.
 * It reads vala_tv_videos now, through the storefront chrome the home loader
 * already resolves, so nothing appears here that a manager has not published.
 *
 * On a route without the home loader there is no match and the list is empty,
 * which the section below already treats as "do not render".
 */
function usePublishedVideos() {
  const home = useMatch({ from: "/", shouldThrow: false });
  const chrome = (home?.loaderData as { chrome?: { videos?: unknown[] } } | undefined)?.chrome;
  const rows = Array.isArray(chrome?.videos) ? chrome.videos : [];
  return rows.map((row) => {
    const v = row as {
      id?: string; title?: string; url?: string | null;
      thumbnail?: string | null; duration?: string | null;
      category?: string | null; views?: number | null;
    };
    return {
      id: String(v.id ?? ""),
      title: String(v.title ?? ""),
      url: v.url ?? "",
      thumbnail: v.thumbnail ?? "",
      duration: v.duration ?? "",
      category: v.category ?? "",
      // Counted from recorded views; omitted rather than shown as a zero.
      views: typeof v.views === "number" ? String(v.views) : "",
      published: true,
      order: 0,
    };
  });
}

// Vala TV — videos are managed from Marketplace Manager -> Growth -> Vala TV
export const ValaTV = () => {
  const videos = usePublishedVideos();
  const [playing, setPlaying] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <section className="py-10">
      {sectionTitle("Vala TV", "/vala-tv", "Demos, walkthroughs, customer films")}
      <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {videos.map((v) => (
          <div key={v.id} className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-br from-[oklch(0.2_0.06_265)] to-[oklch(0.14_0.05_265)] transition-all hover:border-fuchsia-400/40">
            <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 via-cyan-500/10 to-transparent">
              {playing === v.id && hasPlayableVideo(v.url) ? (
                <iframe
                  src={embedUrl(v.url)}
                  title={v.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              ) : hasPlayableVideo(v.url) ? (
                <button
                  type="button"
                  onClick={() => setPlaying(v.id)}
                  aria-label={`Play ${v.title}`}
                  className="absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-2xl motion-safe:transition-transform motion-safe:group-hover:scale-110">
                    <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                  <span className="relative rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold text-white/75">
                    Film not published yet
                  </span>
                </div>
              )}
              {v.duration && (
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{v.duration}</span>
              )}
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-white line-clamp-2">{v.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                <span>{v.views} views</span>
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-300">{v.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Academy — course content lives in @/lib/site-content/academy.
const COURSE_ICON: Record<string, typeof BookOpen> = {
  Beginner: BookOpen,
  Intermediate: GraduationCap,
  Advanced: Building2,
};

export const Academy = () => (
  <section className="py-10">
    {sectionTitle("Vala Academy", "/academy", "Certifications, learning paths, exams")}
    <div className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-3">
      {listCourses().map((course) => {
        const Icon = COURSE_ICON[course.level] ?? BookOpen;
        return (
          <a
            key={course.slug}
            href={`/academy/${course.slug}`}
            aria-label={`Open the ${course.title} learning path`}
            className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-cyan-500/[0.06] to-fuchsia-500/[0.04] p-5 transition-colors hover:border-cyan-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <Icon className="h-7 w-7 text-cyan-300" aria-hidden="true" />
            <div className="mt-3 text-base font-bold text-white">{course.title}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-white/60">
              <span>{course.lessons} lessons</span>
              <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 font-semibold text-fuchsia-300">
                {course.level}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-cyan-300">
              Start learning <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </div>
          </a>
        );
      })}
    </div>
  </section>
);

// Partner Ecosystem
const PARTNERS = [
  { name: "Reseller", desc: "Up to 40% recurring commission", icon: Handshake, color: "text-orange-300", ring: "border-orange-400/30" , applyPath: "/apply/reseller" },
  { name: "Vendor", desc: "List products, reach 50k+ buyers", icon: ShoppingBag, color: "text-emerald-300", ring: "border-emerald-400/30" , applyPath: "/apply/vendor" },
  { name: "Franchise", desc: "Exclusive territory rights", icon: Building2, color: "text-amber-300", ring: "border-amber-400/30" , applyPath: "/apply/franchise" },
  { name: "Author", desc: "Publish & monetise products", icon: BookOpen, color: "text-cyan-300", ring: "border-cyan-400/30" , applyPath: "/apply/author" },
  { name: "Affiliate", desc: "Link, share, earn per sale", icon: Globe2, color: "text-fuchsia-300", ring: "border-fuchsia-400/30" , applyPath: "/apply/affiliate" },
  { name: "Implementation", desc: "Deliver projects on the stack", icon: Wrench, color: "text-violet-300", ring: "border-violet-400/30" , applyPath: "/apply/employee" },
];

export const PartnerEcosystem = () => (
  <section className="py-10">
    {sectionTitle("Partner Ecosystem", "/apply", "Build a business on Software Vala")}
    <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-6">
      {PARTNERS.map((p) => (
        <a key={p.name} href={p.applyPath} className={`group rounded-2xl border ${p.ring} bg-white/[0.03] p-4 transition-all hover:-translate-y-1`}>
          <p.icon className={`h-6 w-6 ${p.color}`} />
          <div className="mt-3 text-sm font-bold text-white">{p.name}</div>
          <div className="mt-1 text-[11px] text-white/60">{p.desc}</div>
        </a>
      ))}
    </div>
  </section>
);

/**
 * Published FAQs, from the database.
 *
 * This used to read a client-side store seeded from a TypeScript file, which
 * meant Marketplace Manager could edit the storefront FAQ and no visitor would
 * ever see the change. The same twenty-eight questions now live in the faqs
 * table, and this reads whatever is published there.
 *
 * On a route without the home loader there is no match and the list is empty,
 * which the section below already treats as "do not render".
 */
function usePublishedFaqs() {
  const home = useMatch({ from: "/", shouldThrow: false });
  const chrome = (home?.loaderData as { chrome?: { faqs?: unknown[] } } | undefined)?.chrome;
  const rows = Array.isArray(chrome?.faqs) ? chrome.faqs : [];
  return rows.map((row) => {
    const f = row as {
      id?: string; question?: string; answer?: string; category?: string;
    };
    return {
      id: String(f.id ?? ""),
      question: String(f.question ?? ""),
      answer: String(f.answer ?? ""),
      category: String(f.category ?? "General"),
      published: true,
      order: 0,
    };
  });
}

/**
 * The schema.org FAQPage for these questions.
 *
 * Built server-side from the same published rows the section renders, so the
 * structured data can never describe questions the page does not show — which
 * is the thing that gets a site penalised for it.
 */
function useFaqSchema() {
  const home = useMatch({ from: "/", shouldThrow: false });
  return (home?.loaderData as { chrome?: { faqSchema?: unknown } } | undefined)?.chrome
    ?.faqSchema ?? null;
}

// FAQ — content managed from Marketplace Manager -> Growth -> FAQ
export const FaqSection = () => {
  const faqs = usePublishedFaqs();
  const faqSchema = useFaqSchema();
  const categories = useMemo(
    () => Array.from(new Set(faqs.map((f) => f.category))),
    [faqs],
  );
  const [activeCat, setActiveCat] = useState<string>("All");
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);

  const visible = activeCat === "All" ? faqs : faqs.filter((f) => f.category === activeCat);
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="py-10">
      {faqSchema ? (
        <script
          type="application/ld+json"
          // The payload is built by the database from published FAQs; no user
          // input reaches it.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}
      {sectionTitle("Frequently Asked Questions", undefined, `Everything about the ${LIFETIME_PRICE} lifetime licence, delivery, demos and partners`)}
      <div className="mb-4 flex flex-wrap gap-2 px-6">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCat(c)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              activeCat === c
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mx-6 max-w-4xl space-y-2">
        {visible.map((f) => {
          const isOpen = open === f.id;
          return (
            <button key={f.id} onClick={() => setOpen(isOpen ? null : f.id)} className={`w-full overflow-hidden rounded-xl border text-left transition-all ${isOpen ? "border-cyan-400/40 bg-cyan-500/[0.04]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"}`}>
              <div className="flex items-center gap-3 px-5 py-4">
                <HelpCircle className={`h-4 w-4 flex-shrink-0 ${isOpen ? "text-cyan-300" : "text-white/60"}`} />
                <span className="flex-1 text-sm font-semibold text-white">{f.question}</span>
                <ChevronRight className={`h-4 w-4 text-white/60 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </div>
              {isOpen && <p className="px-5 pb-4 pl-12 text-xs leading-relaxed text-white/70">{f.answer}</p>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

// Enterprise CTA
export const EnterpriseCTA = () => (
  <section className="px-6 py-12">
    <div className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-[oklch(0.2_0.08_260)] via-[oklch(0.22_0.1_280)] to-[oklch(0.2_0.09_320)] p-8 lg:p-12">
      <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-[120px]" />
      <div className="relative grid items-center gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            <ShieldCheck className="h-3 w-3" /> Enterprise Grade
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-white lg:text-4xl">
            Run your entire business on Software Vala™
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-white/80 lg:text-base">
            Dedicated success manager, custom SLAs, SSO, regional data residency, white-glove migration & 24/7 support — built for teams of 100 to 10,000+.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="mailto:support@softwarevala.net?subject=Enterprise%20enquiry" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-2xl transition-transform hover:scale-[1.03]">
              Talk to Enterprise
            </a>
            <a href="#faq" className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/10">
              Trust & Security
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "50K+", v: "Businesses" },
            { k: "99.99%", v: "Uptime SLA" },
            { k: "120 min", v: "Avg delivery" },
            { k: "24/7", v: "Support" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-md">
              <div className="text-2xl font-bold text-white">{s.k}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
