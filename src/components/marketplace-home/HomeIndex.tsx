import { Fragment, createContext, memo, useContext, useEffect, useRef, useState, type ReactNode, useMemo } from "react";
import { SiteFooter } from "@/components/marketplace-home/SiteFooter";
import { FloatingElements } from "@/components/marketplace-home/FloatingElements";

import { toast } from "sonner";
import { Play, Heart, ShoppingCart, Search, Package, Award, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import softwareValaLogo from "@/assets/software-vala-logo.jpg";
import HeroCarousel from "@/components/marketplace-home/HeroCarousel";
import FestiveBanner from "@/components/marketplace-home/FestiveBanner";
import FeatureStrip from "@/components/marketplace-home/FeatureStrip";
import CategorySlider from "@/components/marketplace-home/CategorySlider";
import UtilityStrip from "@/components/marketplace-home/UtilityStrip";
import SectionBoundary from "@/components/marketplace-home/SectionBoundary";
import {
  IndustryGrid, AIZone, SuccessStories, AwardsRow, LiveActivity,
  ValaTV, Academy as ValaAcademy, PartnerEcosystem, FaqSection, EnterpriseCTA,
} from "@/components/marketplace-home/RefSections";
import { GRID_ANCHOR } from "@/lib/marketplace-home/anchors";
import { useProductActions } from "@/lib/marketplace/useActionLayer";
import { useDebouncedValue, useFavorites } from "@/lib/marketplace-home/persistentState";
import { useHomeRouteData, useHomeRouteMatch } from "@/lib/marketplace/home-route-data";
import CategoryRow from "@/components/marketplace-home/CategoryRow";
import type { CatalogCard } from "@/lib/marketplace/catalog-card";
import { useTranslation } from "@/lib/i18n/use-translation";
import { LIFETIME_DISCOUNT, LIFETIME_MRP, LIFETIME_PRICE, SITE_STATS } from "@/lib/site-content/constants";

interface Demo {
  id: string;
  name: string;
  category: string;
  masterCategory: string;
  description: string;
  url: string;
  icon: any;
  status: "ACTIVE" | "COMING_SOON";
  features: string[];
  frontend: string[];
  backend: string[];
  color: string;
  price: string;
  discountPrice: string;
}




/* ------------------------------------------------------------------ *
 * Card composition
 *
 * Which fields, actions and badges a product card draws. The Product Card
 * Manager writes this and the card reads it, so a switch there changes what a
 * customer sees rather than only a row in a table.
 *
 * A null set means "not configured, or unreadable", and every `shows()` call
 * then returns true — the card renders as it always has. A configuration
 * lookup must never be able to strip a card down to nothing.
 * ------------------------------------------------------------------ */

/**
 * A group the registry does not have is absent, and every key of that kind is
 * drawn. A group it has with nothing switched on is an empty array, which is a
 * decision and hides them all. Mixing the two is what kept Deployment off every
 * card: this file asked for a `platform` group mm_card_fields() never returns.
 */
export type CardComposition = {
  visual?: string[]; metadata?: string[]; action?: string[];
  badge?: string[]; platform?: string[];
};

const CardCompositionContext = createContext<CardComposition | null>(null);

export function CardCompositionProvider({
  value, children,
}: { value: CardComposition | null; children: ReactNode }) {
  return (
    <CardCompositionContext.Provider value={value}>
      {children}
    </CardCompositionContext.Provider>
  );
}

/** Whether the card should draw this key. Unknown keys and no config: yes. */
function useShows(): (kind: keyof CardComposition, key: string) => boolean {
  const composition = useContext(CardCompositionContext);
  return (kind, key) => {
    const list = composition?.[kind];
    if (!Array.isArray(list)) return true;
    return list.includes(key);
  };
}

/* ------------------------------------------------------------------ *
 * Layout Order
 *
 * Which sections the home page shows, and in what order, is a decision the
 * Marketplace Manager makes and this file carries out. Nothing below reads the
 * position of the JSX in this file to decide where a section goes.
 *
 * Every path through this code fails toward rendering. An unreadable registry,
 * an unknown key, a section the registry has never heard of - each of them ends
 * with the section on the page in its built-in position. The home page is a
 * protected route and a configuration lookup must never be able to empty it.
 * ------------------------------------------------------------------ */

/**
 * One section as the registry describes it.
 *
 * Declared here rather than imported so that the server module holding the
 * loader function stays out of the browser bundle.
 */
type SectionLayout = {
  key: string;
  sortOrder: number;
  /** enabled, published and inside its schedule window, folded into one flag. */
  liveNow: boolean;
  visibleMobile: boolean;
  visibleDesktop: boolean;
};

/** Read the RPC's rows into the shape above, tolerating anything missing. */
function toSectionLayout(raw: unknown): SectionLayout[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: SectionLayout[] = [];
  for (const item of raw as Record<string, unknown>[]) {
    const key = typeof item.key === "string" ? item.key : "";
    if (!key) continue;
    rows.push({
      key,
      sortOrder: Number(item.sort_order ?? 0),
      liveNow: item.live_now !== false,
      visibleMobile: item.visible_mobile !== false,
      visibleDesktop: item.visible_desktop !== false,
    });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return rows;
}

/**
 * The layout the page should render with.
 *
 * Prefers the copy the route loader resolved on the server, so the composition
 * is already correct in the HTML and nothing reshuffles after hydration. This
 * component is also drawn by the /marketplace layout, where there is no home
 * route match to read; there it asks for the layout itself.
 */
/** The card composition the loader resolved, if this route carries one. */
function useHomeComposition(): CardComposition | null {
  return (
    useHomeRouteData()?.composition ?? null
  );
}

function useHomeLayout(): SectionLayout[] | null {
  const homeMatch = useHomeRouteMatch();
  const fromServer =
    (homeMatch?.loaderData as { layout?: SectionLayout[] | null } | undefined)
      ?.layout ?? null;

  const [fromClient, setFromClient] = useState<SectionLayout[] | null>(null);

  useEffect(() => {
    if (fromServer) return;
    let cancelled = false;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        // Through the function rather than the table: the table's public policy
        // only exposes enabled rows, so a gate reading it directly could never
        // see the disabled section it is supposed to hide.
        const { data, error } = await supabase.rpc("mm_homepage_sections");
        if (cancelled || error) return;
        const parsed = toSectionLayout(data);
        if (parsed) setFromClient(parsed);
      } catch {
        /* built-in order */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromServer]);

  return fromServer ?? fromClient;
}

/**
 * Hide a section on the devices the manager has switched it off for.
 *
 * Rendered and hidden with a breakpoint class rather than dropped from the
 * tree, because the server does not know the width of the screen it is
 * rendering for. Off on both devices is the one case that renders nothing.
 */
function deviceWrap(mobile: boolean, desktop: boolean, node: ReactNode): ReactNode {
  if (mobile && desktop) return node;
  if (!mobile && !desktop) return null;
  return <div className={mobile ? "md:hidden" : "hidden md:block"}>{node}</div>;
}

/**
 * Compose the page from the registry.
 *
 * `nodes` supplies both the sections this file knows how to draw and, by the
 * order its keys are written in, the fallback order used when the registry
 * cannot be read. The registry's own numbering was seeded from that same order,
 * so a section the registry has never heard of can be placed on the same scale
 * as the ones it has.
 */
function renderSections(
  layout: SectionLayout[] | null,
  nodes: Record<string, ReactNode>,
): ReactNode {
  const byKey = new Map((layout ?? []).map((s) => [s.key, s]));

  const items = Object.keys(nodes).map((key, index) => {
    const reg = byKey.get(key);
    return {
      key,
      order: reg ? reg.sortOrder : index + 1,
      live: reg ? reg.liveNow : true,
      mobile: reg ? reg.visibleMobile : true,
      desktop: reg ? reg.visibleDesktop : true,
      // Keeps the built-in order stable when two sections share a number.
      tie: index,
    };
  });

  items.sort((a, b) => a.order - b.order || a.tie - b.tie);

  return items
    .filter((s) => s.live)
    .map((s) => (
      <Fragment key={s.key}>
        {deviceWrap(s.mobile, s.desktop, nodes[s.key])}
      </Fragment>
    ));
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  // The box asks the catalogue once typing pauses, not on every keystroke.
  const search = useDebouncedValue(searchQuery, 220).trim();
  // Favourites survive a refresh instead of being thrown away.
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const layout = useHomeLayout();
  const composition = useHomeComposition();

  return (
    <CardCompositionProvider value={composition}>
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1e36] to-[#0a1628]">
      {/* Premium Header */}
      <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 py-4 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <img src={softwareValaLogo} alt="Software Vala" className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-lg" />
              <div>
                <h1 className="text-white font-bold text-2xl">Software Vala™</h1>
                <p className="text-white/90 text-sm">- The Name of Trust</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Every product card below reads the composition from here. */}
      {/* The page is composed here, not laid out here. Which of these
          sections appear, and in what order, comes from Layout Order in
          the Marketplace Manager; the order the keys are written in below
          is only the fallback used when the registry cannot be read. */}
      {renderSections(layout, {
        "utility-bar": (
            <SectionBoundary label="The utility bar" fallback={null}>
              <UtilityStrip favoritesCount={favorites.length} />
            </SectionBoundary>
        ),
        "offer-banner": (
            <SectionBoundary label="The offer banner" fallback={null}>
              <FestiveBanner />
            </SectionBoundary>
        ),
        "feature-strip": (
            <SectionBoundary label="The feature strip" fallback={null}>
              <FeatureStrip />
            </SectionBoundary>
        ),
        "hero-carousel": (
            <SectionBoundary label="The featured carousel">
              <HeroCarousel />
            </SectionBoundary>
        ),
        "shop-by-industry": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Shop by Industry" fallback={null}>
              <IndustryGrid />
            </SectionBoundary>
          </div>
        ),
        "category-slider": (
            <SectionBoundary label="The category slider" fallback={null}>
              <CategorySlider />
            </SectionBoundary>
        ),
        "search-bar": (
      <div className="bg-[#0d1e36]/80 backdrop-blur-sm border-b border-cyan-500/20 py-4 px-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input 
                placeholder="Search software..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1a2d4a] border-cyan-500/30 text-white placeholder:text-gray-400"
              />
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {SITE_STATS.solutions} Software · {SITE_STATS.categories} Categories
            </Badge>
          </div>
        </div>
      </div>
        ),
        "catalog-rows": (
      <section id={GRID_ANCHOR} className="scroll-mt-24 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* The catalogue from the database: its rows, or what a search found. */}
          {search ? (
            <SearchResults query={search} favorites={favorites} onToggleFavorite={toggleFavorite} />
          ) : (
            <CatalogRows favorites={favorites} onToggleFavorite={toggleFavorite} />
          )}
        </div>
      </section>
        ),
        // The four curated rows: placed by Layout Order, filled and switched
        // on or off by the Homepage Rows registry.
        "featured-software": (
          <CuratedRow
            rowKey="featured-software" title="Featured Software"
            favorites={favorites} onToggleFavorite={toggleFavorite}
          />
        ),
        "trending-now": (
          <CuratedRow
            rowKey="trending-now" title="Trending Now"
            favorites={favorites} onToggleFavorite={toggleFavorite}
          />
        ),
        "top-selling": (
          <CuratedRow
            rowKey="top-selling" title="Top Selling"
            favorites={favorites} onToggleFavorite={toggleFavorite}
          />
        ),
        "new-releases": (
          <CuratedRow
            rowKey="new-releases" title="New Releases"
            favorites={favorites} onToggleFavorite={toggleFavorite}
          />
        ),
        "ai-zone": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="AI Zone">
              <AIZone />
            </SectionBoundary>
          </div>
        ),
        "success-stories": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Success Stories">
              <SuccessStories />
            </SectionBoundary>
          </div>
        ),
        "awards-champions": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Awards">
              <AwardsRow />
            </SectionBoundary>
          </div>
        ),
        "live-activity": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Live Activity">
              <LiveActivity />
            </SectionBoundary>
          </div>
        ),
        "vala-tv": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Vala TV">
              <ValaTV />
            </SectionBoundary>
          </div>
        ),
        "vala-academy": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Vala Academy">
              <ValaAcademy />
            </SectionBoundary>
          </div>
        ),
        "partner-ecosystem": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="Partner Ecosystem">
              <PartnerEcosystem />
            </SectionBoundary>
          </div>
        ),
        "faq": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="The FAQ section">
              <FaqSection />
            </SectionBoundary>
          </div>
        ),
        "enterprise-cta": (
          <div className="max-w-7xl mx-auto">
            <SectionBoundary label="The enterprise panel">
              <EnterpriseCTA />
            </SectionBoundary>
          </div>
        ),
        "footer": (
            <SectionBoundary label="The footer" fallback={null}>
              <SiteFooter />
            </SectionBoundary>
        ),
        "floating-elements": (
            <SectionBoundary label="The floating elements" fallback={null}>
              <FloatingElements scope="home" />
            </SectionBoundary>
        ),
      })}
    </div>
    </CardCompositionProvider>
  );
};


/* ------------------------------------------------------------------ *
 * Catalogue rows, straight from the database.
 *
 * Real product records, paged, so the browser is never handed the whole
 * catalogue at once. Search results come from the same catalogue
 * (SearchResults, below) and are drawn with the same card.
 * ------------------------------------------------------------------ */

// The marketplace's one product card (src/lib/marketplace/catalog-card.ts).
export type { CatalogCard };

type CatalogRow = {
  id: string; title: string; slug: string; href: string;
  cards: CatalogCard[]; total: number; hasMore: boolean;
};

const ROW_PAGE = 8;
const CARD_PAGE = 12;

/**
 * How many products a category row carries.
 *
 * The row is seeded with a first page so the document itself is small and
 * crawlable, then fills to this many the moment the reader reaches it. A
 * category holding more than this keeps its "Show more" control, so a row is
 * never capped at the target - the catalogue is heading well past it.
 */
const ROW_TARGET = 60;

/** The first page of rows, as the home route's loader prepared it. */
type CatalogSeed = {
  rows: CatalogRow[];
  rowOffset: number;
  rowCount: number;
  totalRows: number;
  hasMoreRows: boolean;
} | null;

/**
 * The merchandising badges, by the key the Product Card Manager stores them
 * under (marketplace_card_fields, kind `badge`) and the product flag each one
 * reads. Order here is the order they are drawn in.
 */
const MERCH_BADGES = [
  { key: "badge-featured", flag: "featured", message: "marketplace.card.badge.featured", className: "bg-amber-400/90 text-black" },
  { key: "badge-new", flag: "newRelease", message: "marketplace.card.badge.new", className: "bg-cyan-400/90 text-black" },
  { key: "badge-trending", flag: "trending", message: "marketplace.card.badge.trending", className: "bg-fuchsia-500/90 text-white" },
  { key: "badge-best-seller", flag: "bestSeller", message: "marketplace.card.badge.bestseller", className: "bg-rose-500/90 text-white" },
] as const;

/** Card colours cycle through the same palette the hand-written rows use. */
const CARD_COLORS = [
  "from-blue-600 to-indigo-600", "from-emerald-600 to-teal-600",
  "from-fuchsia-600 to-purple-600", "from-amber-500 to-orange-600",
  "from-rose-600 to-pink-600", "from-cyan-600 to-sky-600",
];

/** A catalogue row shaped like the cards this page already draws. */
export function toDemo(card: CatalogCard, index: number): Demo {
  return {
    id: card.id,
    name: card.name,
    category: card.subcategory ?? card.industry ?? "",
    masterCategory: card.industry ?? "",
    // The product's own description. This used to be a sentence built out of
    // the industry name because the description was never fetched.
    description:
      card.description ??
      (card.industry
        ? `${card.industry}${card.country ? ` · targeted at ${card.country}` : ""}`
        : ""),
    url: card.href,
    icon: Package,
    // Twelve products in the catalogue have a demo. This used to say ACTIVE
    // for all of them.
    status: card.hasDemo ? "ACTIVE" : "LISTED",
    features: card.features ?? [],
    frontend: card.tech ?? [],
    backend: [],
    color: CARD_COLORS[index % CARD_COLORS.length]!,
    price: card.price ?? LIFETIME_PRICE,
    discountPrice: card.price ?? LIFETIME_PRICE,
    rating: card.rating,
    license: card.license,
    platform: card.platform,
    hasDemo: card.hasDemo,
    slug: card.slug,
    // The product's own merchandising flags. They were read from the database
    // and then dropped here, so the three badges an operator has switched on in
    // the Product Card Manager - New, Trending, Featured - had no value to draw
    // and the controls did nothing at all.
    featured: card.featured,
    trending: card.trending,
    bestSeller: card.bestSeller,
    newRelease: card.newRelease,
    // The Live Demo button opens the demo itself, through the signed-in
    // gateway, not the product page.
    demoUrl: card.hasDemo && card.slug ? `/demo/${card.slug}` : null,
  } as unknown as Demo;
}

function CatalogRowStrip({
  row, favorites, onToggleFavorite,
}: {
  row: CatalogRow;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const [cards, setCards] = useState<CatalogCard[]>(row.cards);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inView = useRef<HTMLDivElement>(null);
  const toppedUp = useRef(false);

  /** How many this row should be holding: its target, or all it has. */
  const wanted = Math.min(row.total, ROW_TARGET);

  const load = async (count: number) => {
    if (loading || count <= 0) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/marketplace/catalog?category=${encodeURIComponent(row.slug)}` +
          `&offset=${cards.length}&limit=${count}`,
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setCards((current) => [...current, ...(data.cards ?? [])]);
    } catch {
      setFailed(true);
      toppedUp.current = false;   // let reaching the row try again
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fill the row to its target when the reader reaches it.
   *
   * The row arrived holding a first page and waited for a button press to show
   * anything more, so a category of sixty products showed twelve and looked
   * like a category of twelve. The rest are asked for in one request rather
   * than a page at a time, because they are all going into the same strip.
   */
  useEffect(() => {
    const node = inView.current;
    if (!node || toppedUp.current || cards.length >= wanted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || toppedUp.current) return;
        toppedUp.current = true;
        void load(wanted - cards.length);
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, cards.length]);

  const remaining = row.total - cards.length;

  // Built once per card list rather than on every render, so `memo` on the card
  // has a stable object to compare.
  const demos = useMemo(() => cards.map((card, index) => toDemo(card, index)), [cards]);

  return (
    <CategoryRow title={row.title} count={row.total}>
      <div ref={inView} aria-hidden="true" className="w-0 flex-none" />
      {demos.map((demo, index) => (
        <div key={demo.id} className="w-[300px] flex-none snap-start sm:w-[330px]">
          <DemoCard
            demo={demo}
            index={index}
            isFavorite={favorites.includes(demo.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div className="flex w-[220px] flex-none items-center justify-center">
          <button
            type="button"
            onClick={() => void load(Math.min(remaining, ROW_TARGET))}
            disabled={loading}
            className="rounded-xl border border-cyan-400/30 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-white/[0.08] disabled:opacity-60"
          >
            {loading
              ? "Loading…"
              : failed
                ? "Try again"
                : `Show more (${remaining} left)`}
          </button>
        </div>
      )}
    </CategoryRow>
  );
}

/**
 * The curated rows (Featured Software, Trending Now, Top Selling, New
 * Releases), by the key the Homepage Rows registry and Layout Order share.
 */
const CURATED_ROW_KEYS = new Set(["featured-software", "trending-now", "top-selling", "new-releases"]);

/**
 * A curated row, drawn once, where Layout Order places it.
 *
 * Its products and whether it is live come from the Homepage Rows registry -
 * the products the manager placed, its publish state and schedule - which the
 * catalogue reader already resolves into the server-rendered first page
 * (src/lib/marketplace/catalog.server.ts). The row used to be drawn twice:
 * once there, inside the catalogue, and once here from products carrying a
 * flag, which also ignored a row the manager had taken down.
 *
 * Returns null when the registry has the row off or it holds nothing: a
 * heading over an empty rail reads as broken.
 */
function CuratedRow({
  rowKey,
  title,
  favorites,
  onToggleFavorite,
}: {
  rowKey: string;
  title: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const seeded = (useHomeRouteData()?.seed as CatalogSeed | undefined) ?? null;
  const row = useMemo(
    () => ((seeded?.rows as CatalogRow[] | undefined) ?? []).find((r) => r.id === rowKey) ?? null,
    [seeded, rowKey],
  );
  const picked = useMemo(
    // Drawn like every other catalogue card, through toDemo.
    () => (row?.cards ?? []).map((card, index) => toDemo(card, index)),
    [row],
  );
  if (picked.length === 0) return null;
  return (
    <div className="max-w-7xl mx-auto px-4">
      <CategoryRow title={row?.title ?? title} count={row?.total ?? picked.length}>
        {picked.map((demo, index) => (
          <div key={demo.id} className="w-[300px] flex-none snap-start sm:w-[330px]">
            <DemoCard
              demo={demo}
              index={index}
              isFavorite={favorites.includes(demo.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </CategoryRow>
    </div>
  );
}

function CatalogRows({
  favorites, onToggleFavorite,
}: {
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  // What the server already rendered for the home page. Starting from it means
  // the first rows are in the HTML itself rather than appearing a moment later,
  // and the browser does not ask twice for the same thing.
  //
  // This component is also drawn by the /marketplace layout, where there is no
  // such match. Asking for the home route's data there threw, and the throw
  // took the whole server render down with it - every page under /marketplace
  // arrived as an empty shell that only filled in once its JavaScript ran. So
  // the match is requested without throwing, and its absence simply means
  // nothing was seeded and the rows are fetched as before.
  const homeMatch = useHomeRouteMatch();
  const seeded =
    (homeMatch?.loaderData as { seed?: CatalogSeed } | undefined)?.seed ?? null;

  const [rows, setRows] = useState<CatalogRow[] | null>(
    (seeded?.rows as CatalogRow[] | undefined) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [rowOffset, setRowOffset] = useState(seeded?.rowCount ?? 0);
  const [hasMoreRows, setHasMoreRows] = useState(Boolean(seeded?.hasMoreRows));
  const [loadingRows, setLoadingRows] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const fetchRows = async (offset: number) => {
    setLoadingRows(true);
    try {
      const response = await fetch(
        `/api/marketplace/catalog?rows=${ROW_PAGE}&perRow=${CARD_PAGE}&rowOffset=${offset}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "The catalogue could not be read.");
      setRows((current) => [...(current ?? []), ...(data.rows ?? [])]);
      setHasMoreRows(Boolean(data.hasMoreRows));
      setRowOffset(offset + (data.rowCount ?? 0));
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The catalogue could not be read.");
      if (rows === null) setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    // Only ask when the server sent nothing; otherwise the first page is
    // already on screen and the next one arrives on scroll.
    if (seeded?.rows?.length) return;
    void fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rows arrive as the reader reaches the bottom, not all at once.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMoreRows) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingRows) void fetchRows(rowOffset);
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRows, rowOffset, loadingRows]);

  if (rows === null) {
    return (
      <div className="px-6 py-16 text-center text-sm text-white/60">
        Loading the marketplace…
      </div>
    );
  }
  if (error && rows.length === 0) {
    return (
      <div className="mx-6 rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
        <p className="text-sm text-white/70">{error}</p>
        <button
          type="button"
          onClick={() => void fetchRows(0)}
          className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Curated rows are drawn where Layout Order places them (CuratedRow). */}
      {rows.filter((row) => !CURATED_ROW_KEYS.has(row.id)).map((row) => (
        <CatalogRowStrip
          key={row.id}
          row={row}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {loadingRows && (
        <p className="py-6 text-center text-xs text-white/50">Loading more categories…</p>
      )}
      {error && rows.length > 0 && (
        <p className="py-4 text-center text-xs text-white/50">{error}</p>
      )}
    </>
  );
}

/**
 * What the search box found, from the marketplace's one search
 * (/api/marketplace/search), drawn with the same card as the catalogue rows.
 */
function SearchResults({
  query, favorites, onToggleFavorite,
}: {
  query: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [cards, setCards] = useState<CatalogCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCards(null);
    setFailed(false);
    fetch(`/api/marketplace/search?format=cards&limit=40&q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { cards?: CatalogCard[] };
        if (!response.ok) throw new Error(String(response.status));
        setCards(data.cards ?? []);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCards([]);
        setFailed(true);
      });
    return () => controller.abort();
  }, [query, attempt]);

  if (cards === null) {
    return (
      <p className="px-6 py-16 text-center text-sm text-white/60" aria-live="polite">
        {t("marketplace.search.searching")}
      </p>
    );
  }
  if (failed || cards.length === 0) {
    return (
      <div
        className="mx-6 rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center"
        aria-live="polite"
      >
        <p className="text-sm text-white/70">
          {failed ? t("marketplace.search.failed") : t("marketplace.search.none", { query })}
        </p>
        {failed && (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
          >
            {t("marketplace.search.retry")}
          </button>
        )}
      </div>
    );
  }
  return (
    <CategoryRow title={t("marketplace.search.results", { query })} count={cards.length}>
      {cards.map((card, index) => {
        const demo = toDemo(card, index);
        return (
          <div key={card.id} className="w-[300px] flex-none snap-start sm:w-[330px]">
            <DemoCard
              demo={demo}
              index={index}
              isFavorite={favorites.includes(demo.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        );
      })}
    </CategoryRow>
  );
}

// Demo Card Component - Enhanced with interactions
/**
 * `onToggleFavorite` takes the product id rather than closing over it, so a row
 * can hand every card the same stable function. Each card used to be given a
 * fresh `() => toggle(id)` arrow and a freshly built `demo` object on every
 * render, which meant `memo` never once matched: favouriting a single product
 * re-rendered every card on the page - several thousand of them once the rows
 * have filled - and each re-render re-ran the action resolver.
 */
export const DemoCard = memo(({ demo, index, isFavorite, onToggleFavorite }: {
  demo: Demo;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) => {
  // The Action Layer's answer for this product. One shared fetch backs every
  // card on the page, so a grid of hundreds costs a single request.
  const { actions: layerActions } = useProductActions({
    id: (demo as unknown as { id?: string }).id ?? null,
    slug: (demo as unknown as { slug?: string }).slug ?? null,
    demo_url: (demo as unknown as { url?: string }).url ?? null,
    visible: true,
    price_label: (demo as unknown as { discountPrice?: string }).discountPrice ?? null,
    content_status: null,
  });
  const allowed = (key: string) => {
    const a = layerActions.find((x) => x.key === key);
    // Unknown to the registry means "not governed here" — the card keeps its
    // existing behaviour rather than losing a button to a missing entry.
    return a ? a.enabled && a.visibility !== "HIDDEN" : true;
  };

  const Icon = demo.icon;
  const shows = useShows();
  const { t } = useTranslation();

  /** The product's own merchandising flags, for the badges above. */
  const merch = demo as unknown as Record<string, boolean | undefined>;

  // Which of the two panels actually has something in it. A tab with nothing
  // behind it used to be drawn anyway: every catalogue card offered "Tech
  // Stack", and opening it showed an empty box, because no product in the
  // catalogue records a tech stack.
  const featureList = demo.features ?? [];
  const techList = [...(demo.frontend ?? []), ...(demo.backend ?? [])];
  const hasFeatures = featureList.length > 0;
  const hasTech = techList.length > 0;
  const panels = [
    hasFeatures && {
      id: "features" as const,
      message: "marketplace.card.tab.features" as const,
      chips: featureList,
      tone: "",
      chipClass: "border-cyan-500/30 text-cyan-300 bg-cyan-500/10",
    },
    hasTech && {
      id: "tech" as const,
      message: "marketplace.card.tab.tech" as const,
      chips: techList,
      tone: "sv-tab-alt",
      chipClass: "border-purple-500/30 text-purple-300 bg-purple-500/10",
    },
  ].filter(Boolean) as {
    id: "features" | "tech"; message: "marketplace.card.tab.features" | "marketplace.card.tab.tech";
    chips: string[]; tone: string; chipClass: string;
  }[];

  const [activeTab, setActiveTab] = useState<'features' | 'tech'>('features');
  // A panel can empty out when the card is reused for another product, so the
  // open tab is corrected rather than left pointing at nothing.
  const openTab: 'features' | 'tech' =
    panels.some((p) => p.id === activeTab) ? activeTab : (panels[0]?.id ?? 'features');

  return (
    <div className="sv-card-shell relative">
      <Card className="sv-card group h-full overflow-hidden border-cyan-500/20 bg-gradient-to-br from-[#1a2d4a] to-[#0d1e36]">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header with gradient */}
          <div className={`sv-card-head bg-gradient-to-r ${demo.color} p-4 relative overflow-hidden`}>
            <div className="flex justify-between items-start relative z-10">
              <div className="sv-card-icon rounded-xl bg-white/20 p-3">
                <Icon className="h-8 w-8 text-white" />
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 items-center">
                {/* The merchandising badges the Product Card Manager switches
                    on, drawn from the product's own flags. Nothing is invented:
                    a badge appears only where the record carries the flag. */}
                {shows("metadata", "badges") &&
                  MERCH_BADGES.filter(
                    (b) => shows("badge", b.key) && Boolean(merch[b.flag]),
                  ).map((b) => (
                    <Badge key={b.key} className={`${b.className} font-bold text-[10px] uppercase`}>
                      {t(b.message)}
                    </Badge>
                  ))}
                {demo.status === "COMING_SOON" && (
                  <Badge className="bg-yellow-500/90 text-black font-bold text-xs animate-pulse">
                    COMING SOON
                  </Badge>
                )}
                {/* Only for a product that actually has one. */}
                {demo.status === "ACTIVE" && (
                  <Badge className="sv-live-badge bg-emerald-500/90 text-white font-bold text-xs flex items-center gap-1">
                    <span className="sv-live-dot" />
                    LIVE DEMO
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick action buttons on hover. Above the header row (z-10),
                which spans the card and otherwise took the clicks meant for
                the favourite and preview buttons. */}
            <div className="sv-card-quick absolute bottom-2 right-2 z-20 flex gap-2">
              {/* Wishlist is a Product Card Manager action like any other; the
                  heart used to ignore its switch entirely. */}
              {shows("action", "wishlist") && (
              <button
                data-no-3d
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(demo.id);
                  toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites!');
                }}
                className="sv-icon-btn"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </button>
              )}
              <a
                href={demo.url}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Preview ${demo.name}`}
                className="sv-icon-btn"
              >
                <Eye className="h-4 w-4 text-white" />
              </a>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-1">
              {shows("metadata", "product-name") && (
                <h3 className="text-[17px] font-extrabold tracking-[-0.01em] text-white leading-snug">{demo.name}</h3>
              )}
              {demo.status === "ACTIVE" && (
                <Badge className="bg-cyan-500/20 text-cyan-300 text-[10px] shrink-0 ml-2">
                  #{index + 1}
                </Badge>
              )}
            </div>
            {shows("metadata", "category") && demo.category && (
              <p className="text-cyan-300/90 text-[11px] font-semibold uppercase tracking-[0.08em] mb-2 flex items-center gap-1">
                <Award className="h-3 w-3" /> {demo.category}
              </p>
            )}
            {/* Drawn only when the product actually has one. The paragraph was
                rendered unconditionally, so a product without a description
                left two empty lines and a margin in the middle of the card. */}
            {shows("metadata", "short-description") && demo.description && (
              <p className="text-gray-400 text-[13px] leading-relaxed mb-3 line-clamp-2">{demo.description}</p>
            )}

            {/* Interactive Tabs — drawn only when there is something to put in
                them. Both panels were empty on every catalogue card, because
                toDemo passed empty arrays. */}
            {(hasFeatures || hasTech) && (
            <div className="mb-3">
              {/* A tab is offered only for a panel that has something in it.
                  Both were offered whenever *either* had content, so a product
                  with features and no tech stack carried a "Tech Stack" tab
                  that opened an empty box. Across 398 catalogue cards sampled
                  from the live marketplace that is one card - 173 carry both
                  and 224 carry neither - so this is an edge rather than a
                  widespread fault, and it is still not something to draw.

                  When only one panel has content there is nothing to switch
                  between, so the heading is a label rather than a pair of
                  buttons. The panel's fixed 52px minimum went with it: it was
                  reserving the height of chips that were not there. */}
              <div className="flex gap-1 mb-2">
                {panels.map((panel) =>
                  panels.length > 1 ? (
                    <button
                      key={panel.id}
                      data-no-3d
                      onClick={() => setActiveTab(panel.id)}
                      className={`sv-tab ${openTab === panel.id ? `sv-tab-on ${panel.tone}` : ''}`}
                    >
                      {t(panel.message)}
                    </button>
                  ) : (
                    <span key={panel.id} className={`sv-tab sv-tab-on ${panel.tone}`}>
                      {t(panel.message)}
                    </span>
                  ),
                )}
              </div>

              <div className="sv-fade-swap" key={openTab}>
                <div className="flex flex-wrap gap-1">
                  {(panels.find((p) => p.id === openTab) ?? panels[0])?.chips.map((chip) => (
                    <Badge
                      key={chip}
                      variant="outline"
                      className={`sv-chip text-[10px] ${
                        (panels.find((p) => p.id === openTab) ?? panels[0])!.chipClass
                      }`}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* The foot of the card: price, actions and facts, together.
                Only the actions carried `mt-auto` before, so the slack in a
                card shorter than its neighbours opened up between the price and
                the buttons and the prices in a row sat at different heights.
                Keeping the three together means every card in a row has one gap
                and its foot lines up with the rest. */}
            <div className="mt-auto pt-1">
            {/* Price, from the product record.
                Almost every product carries the standard lifetime price, and
                for those the was-price and the discount are shown as before.
                The handful priced "Custom" or "Contact" were being shown $249
                and a 75% discount that did not apply to them. */}
            {shows("metadata", "price") && (() => {
              const price = (demo as unknown as { price?: string }).price || LIFETIME_PRICE;
              const standard = price === LIFETIME_PRICE;
              return (
                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    {standard && (
                      <span className="text-gray-500 line-through text-[13px]">{LIFETIME_MRP}</span>
                    )}
                    <span className="sv-price text-emerald-300 font-black text-[22px] tracking-[-0.02em]">
                      {price}
                    </span>
                    {standard && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px] font-bold">
                        {LIFETIME_DISCOUNT}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80">
                    {standard ? "One-time payment · Lifetime access" : "Pricing on request"}
                  </p>
                </div>
              );
            })()}

            {/* Enhanced Actions
                Two gates, and they answer different questions. `shows()` is the
                card composition - whether this card is configured to draw the
                button. `allowed()` is the Action Layer - whether the
                marketplace offers the action at all, to this product, right
                now. Both have to say yes.

                Only Live Demo used to ask the first question. Buy Now and View
                Details went straight to the Action Layer, so their switches in
                Product Card Manager governed nothing: turning Buy Now off there
                changed no card on the marketplace. */}
            {(() => {
              // The card's own product page, and the demo it actually has.
              // demo.url is the product page for catalogue cards and a /demo
              // path for the seeded ones, so both are honoured.
              const d = demo as unknown as {
                url?: string; href?: string; slug?: string;
                hasDemo?: boolean; demoUrl?: string | null;
              };
              const productHref = d.href ?? d.url ?? (d.slug ? `/marketplace/product/${d.slug}` : "#");
              const demoHref = d.demoUrl ?? (d.hasDemo ? productHref : d.url && d.url.startsWith("/demo/") ? d.url : null);
              const buyHref = `${productHref}${productHref.includes("?") ? "&" : "?"}buy=1`;
              return (
            <div className="flex gap-2">
              {demo.status === "ACTIVE" ? (
                <>
                  {/* Only offered when there is a demo to open. */}
                  {shows("action", "live-demo") && allowed("LIVE_DEMO") && demoHref && (
                    <a href={demoHref} className="flex-1" target={demoHref.startsWith("http") || demoHref.startsWith("/demo/") ? "_blank" : undefined} rel="noreferrer">
                      <Button className="sv-btn sv-btn-cyan w-full">
                        <Play className="h-4 w-4 mr-2" /> Live Demo
                      </Button>
                    </a>
                  )}
                  {/* Goes to the product page ready to buy. The Add to cart
                      mutation and the sign-in redirect already live there. */}
                  {shows("action", "buy-now") && allowed("BUY_NOW") && (
                    <a href={buyHref} className="flex-1">
                      <Button className="sv-btn sv-btn-emerald w-full">
                        <ShoppingCart className="h-4 w-4 mr-2" /> Buy Now
                      </Button>
                    </a>
                  )}
                </>
              ) : (
                <>
                  {shows("action", "view-details") && allowed("VIEW_DETAILS") && (
                    <a href={productHref} className="flex-1">
                      <Button className="sv-btn sv-btn-cyan w-full">
                        <Eye className="h-4 w-4 mr-2" /> View details
                      </Button>
                    </a>
                  )}
                  {shows("action", "buy-now") && allowed("BUY_NOW") && (
                    <a href={buyHref} className="flex-1">
                      <Button className="sv-btn sv-btn-emerald w-full">
                        <ShoppingCart className="h-4 w-4 mr-2" /> Buy Now
                      </Button>
                    </a>
                  )}
                </>
              )}
            </div>
              );
            })()}
            
            {/* Facts the catalogue actually holds.
                This strip used to show a client count, a rating and a delivery
                time computed from a hash of the product id — invented numbers
                presented as business metrics. Eight products in the catalogue
                have a real rating; none has a client count or a delivery time.
                Whatever is real is shown, and when nothing is, the strip is
                not drawn. */}
            {(() => {
              const d = demo as unknown as {
                rating?: number | null; license?: string | null; platform?: string | null;
              };
              const cells: { value: string; label: string; tone: string }[] = [];
              if (shows("metadata", "rating") && typeof d.rating === "number" && d.rating > 0) {
                cells.push({ value: d.rating.toFixed(1), label: "Rating", tone: "text-emerald-400" });
              }
              if (shows("metadata", "license") && d.license)
                cells.push({ value: d.license, label: "Licence", tone: "text-cyan-400" });
              // The registry field for the product's `deployment` column is
              // metadata/platform. This asked for platform/platform-web, which
              // is one of the six platform *badges* and a kind mm_card_fields()
              // does not return at all, so the cell could never be drawn -
              // Deployment was missing from every card on the marketplace even
              // though two products in three carry the value.
              if (shows("metadata", "platform") && d.platform)
                cells.push({ value: d.platform, label: "Deployment", tone: "text-purple-400" });
              if (cells.length === 0) return null;
              return (
                // One slim strip instead of a stacked grid: the same facts and
                // the same tone colours, on a single line inside a glass pill.
                // Value and label sit side by side, so three facts cost one line
                // of height rather than four.
                <div className="sv-card-stats mt-2 flex flex-wrap items-center gap-1.5">
                  {cells.map((c) => (
                    <span
                      key={c.label}
                      title={`${c.label}: ${c.value}`}
                      className="inline-flex min-w-0 items-baseline gap-1 rounded-full border border-cyan-500/15 bg-gradient-to-r from-white/[0.06] to-white/[0.02] px-2 py-[3px] backdrop-blur-sm"
                    >
                      <span className={`${c.tone} truncate text-[11px] font-bold leading-none`}>
                        {c.value}
                      </span>
                      <span className="shrink-0 text-[9px] uppercase tracking-wide text-gray-500">
                        {c.label}
                      </span>
                    </span>
                  ))}
                </div>
              );
            })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
DemoCard.displayName = "DemoCard";

export default Index;
