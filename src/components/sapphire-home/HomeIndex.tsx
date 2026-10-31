import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { allDemos, catalogueSlug, type HomeDemo } from "@/data/catalogue";
import { useSavedProducts } from "@/lib/useSavedProducts";

import { motion } from "framer-motion";
import { toast } from "sonner";

import { ProductLeadDialog, type LeadAction } from "@/components/sapphire-home/ProductLeadDialog";
import {
  Award,
  Bell,
  Clock,
  Copy,
  Eye,
  Facebook,
  Filter,
  Heart,
  Hotel,
  Linkedin,
  Mail,
  MessageCircle,
  Play,
  Search,
  Share2,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import softwareValaLogo from "@/assets/software-vala-logo.jpg";
import HeroCarousel from "@/components/sapphire-home/HeroCarousel";
import FestiveBanner from "@/components/sapphire-home/FestiveBanner";
import FeatureStrip from "@/components/sapphire-home/FeatureStrip";
import CategorySlider from "@/components/sapphire-home/CategorySlider";
import UtilityStrip from "@/components/sapphire-home/UtilityStrip";
import ProductCarouselRow from "@/components/sapphire-home/ProductCarouselRow";
import {
  IndustryGrid,
  AIZone,
  SuccessStories,
  AwardsRow,
  LiveActivity,
  ValaTV,
  Academy as ValaAcademy,
  PartnerEcosystem,
  FaqSection,
  EnterpriseCTA,
} from "@/components/sapphire-home/RefSections";
import { extraDemos, allMasterCategories55 } from "@/data/extraDemos";
import { catalogueSlugForShelf } from "@/lib/marketplace/home-category-map";
import { demoNumbersForCards, marketplaceDemoHref } from "@/lib/marketplace/demo-link";
import { fetchCountryRail, railCardToDemo, shelfColour } from "@/lib/marketplace/country-rail";
import { RAIL_COUNTRIES } from "@/lib/marketplace/rail-countries";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useCatalogueCounts } from "@/components/sapphire-home/useCatalogueCounts";
import { LIFETIME_DISCOUNT, LIFETIME_MRP, LIFETIME_PRICE } from "@/lib/site-content/constants";
import {
  countryCardCapacity,
  fillProductRail,
  HOMEPAGE_CARDS_PER_ROW,
} from "@/lib/marketplace/product-rail";

// Master Categories for filtering (55 rows — matches actual data values)
const masterCategories = ["All", ...allMasterCategories55];

/**
 * The gradient for a shelf that has no static entries to take one from: the
 * catalogue's country cards are the whole shelf, so they need a colour of
 * their own, in the same two-stop style as every other shelf.
 */
const CATALOGUE_SHELF_COLOUR: Record<string, string> = {
  Childcare: "from-pink-400 to-rose-500",
  Coaching: "from-amber-500 to-orange-600",
  "College ERP": "from-indigo-500 to-blue-600",
  "Cultural & Arts": "from-fuchsia-500 to-purple-600",
  "Digital Wallet": "from-emerald-500 to-teal-600",
  "Entertainment & Media": "from-red-500 to-rose-600",
  "Fleet Management": "from-slate-500 to-blue-700",
  "Hospital HMS": "from-cyan-500 to-blue-600",
  "Hotel HMS": "from-amber-600 to-yellow-700",
  "Learning Management": "from-violet-500 to-indigo-600",
  "Marketplace & Super Apps": "from-orange-500 to-pink-600",
  "Pet Care & Services": "from-lime-500 to-green-600",
  "Property Management": "from-stone-500 to-amber-700",
  "Public Transport": "from-sky-500 to-indigo-600",
  "Research & Analytics": "from-blue-500 to-violet-600",
  "Restaurant POS": "from-orange-600 to-red-600",
  "School Management": "from-teal-500 to-cyan-600",
};
/**
 * The real catalogue products for one shelf, added after the shelf's own cards.
 *
 * A shelf is one category and every card it adds is one country, in the order
 * src/lib/marketplace/rail-countries.ts publishes, so the same position is the
 * same country on every shelf. The catalogue already holds one product per
 * category per country; this asks for that shelf's row and renders it with the
 * card the page has always used.
 *
 * It fetches nothing until the shelf is close to the screen, and nothing at
 * all on a shelf with no catalogue row, so the page it arrives on is exactly
 * the page that arrived before. A product the shelf already shows is not shown
 * twice, and a failed request leaves the shelf as it was.
 */
const CountryRailCards = memo(function CountryRailCards({
  shelf,
  colour,
  already,
  maxCards,
  demoNumberOffset,
  favorites,
  onToggleFavorite,
  onLoaded,
}: {
  shelf: string;
  colour: string;
  /** The slugs the shelf already shows, joined, so the memo around this holds. */
  already: string;
  maxCards: number;
  demoNumberOffset: number;
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
  onLoaded: (shelf: string, count: number) => void;
}) {
  const [cards, setCards] = useState<HomeDemo[]>([]);
  const anchor = useRef<HTMLSpanElement>(null);
  const slug = catalogueSlugForShelf(shelf);
  const skip = useMemo(() => new Set(already.split(",").filter(Boolean)), [already]);
  const visibleCards = useMemo(() => fillProductRail(cards, maxCards), [cards, maxCards]);

  useEffect(() => {
    if (!slug) return;
    const node = anchor.current?.closest("section.sv-product-row") ?? anchor.current;
    if (!node) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void (async () => {
          const page = await fetchCountryRail(slug, RAIL_COUNTRIES.length, controller.signal);
          if (!page) return;
          const mapped = page.cards
            .filter((card) => !skip.has(catalogueSlug(card.name)))
            .map((card) => railCardToDemo(card, shelf, colour));
          setCards(mapped);
          onLoaded(shelf, mapped.length);
        })();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [slug, shelf, colour, onLoaded, skip]);

  const demoNumbers = demoNumbersForCards(cards, demoNumberOffset);

  return (
    <>
      <span ref={anchor} aria-hidden className="block w-0 shrink-0" />
      {visibleCards.map((demo, index) => (
        <DemoCard
          key={`${shelf}-country-${demo.id}-${index}`}
          demo={demo}
          demoNumber={demoNumbers[index]}
          isFavorite={favorites.includes(catalogueSlug(demo.name))}
          onToggleFavorite={() => onToggleFavorite(catalogueSlug(demo.name))}
        />
      ))}
    </>
  );
});

const Index = () => {
  const { t } = useTranslation();
  const counts = useCatalogueCounts();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  // How many real catalogue products each shelf has added. A shelf that has
  // added none is padded exactly as it was before, so a page where the
  // catalogue cannot be reached is the page that shipped yesterday.
  const [addedByShelf, setAddedByShelf] = useState<Record<string, number>>({});
  const noteAdded = useCallback((shelf: string, count: number) => {
    setAddedByShelf((current) =>
      current[shelf] === count ? current : { ...current, [shelf]: count },
    );
  }, []);
  // Saved products belong to the person, not to one browser. Signed out,
  // they are kept in this browser as before and carried up on the next sign-in.
  const { favorites, toggle: toggleFavorite } = useSavedProducts();

  const filteredDemos = allDemos.filter((demo) => {
    const matchesCategory = activeCategory === "All" || demo.masterCategory === activeCategory;
    const matchesSearch =
      demo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      demo.masterCategory.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Count demos per master category
  const getCategoryCount = (category: string) => {
    if (category === "All") return allDemos.length;
    return allDemos.filter((d) => d.masterCategory === category).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1e36] to-[#0a1628]">
      {/* Premium Header */}
      <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 py-4 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <img
                src={softwareValaLogo}
                alt="Software Vala"
                className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-lg"
              />
              <div>
                <h1 className="text-white font-bold text-2xl">Software Vala</h1>
                <p className="text-white/90 text-sm">- The Name of Trust</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Utility strip — clone of the feature strip, different subject */}
      <UtilityStrip favoritesCount={favorites.length} />

      {/* Running offer ticker sits between the two strips */}
      <FestiveBanner />

      <FeatureStrip />

      {/* The page's content, as a landmark the skip link and screen readers can reach. */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <HeroCarousel />

        {/* Industry Grid */}
        <div className="max-w-7xl mx-auto">
          <IndustryGrid />
        </div>

        {/* Category Slider (auto-scroll) */}
        <CategorySlider />

        {/* Category Filter - Master Categories */}
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
                {filteredDemos.length} Products
              </Badge>
            </div>
          </div>
        </div>

        {/* Netflix-style product rows */}
        <section className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Group by Master Category when "All" is selected */}
            {activeCategory === "All" ? (
              masterCategories.slice(1).map((masterCat) => {
                const categoryDemos = filteredDemos.filter((d) => d.masterCategory === masterCat);
                // A shelf with no static entries is shown only when the
                // catalogue fills it: not while searching (the country cards
                // are not searched), not without a catalogue row, and not once
                // its row has come back empty.
                if (
                  categoryDemos.length === 0 &&
                  (searchQuery.trim() ||
                    !catalogueSlugForShelf(masterCat) ||
                    addedByShelf[masterCat] === 0)
                ) {
                  return null;
                }
                // The shelf's own cards are repeated only as far as the real
                // catalogue cards do not already fill the rail: a country card
                // takes the place of a duplicate, never of a real one.
                const added = searchQuery.trim()
                  ? 0
                  : countryCardCapacity(categoryDemos, addedByShelf[masterCat] ?? 0);
                const rowDemos = searchQuery.trim()
                  ? fillProductRail(categoryDemos)
                  : fillProductRail(categoryDemos, HOMEPAGE_CARDS_PER_ROW - added);
                const countryCardLimit = Math.max(HOMEPAGE_CARDS_PER_ROW - rowDemos.length, 0);
                const demoNumbers = demoNumbersForCards(rowDemos);

                return (
                  // The rail repeats its cards to fill the row; the count says
                  // how many different products it holds, not how many tiles.
                  <ProductCarouselRow
                    key={masterCat}
                    title={masterCat}
                    count={
                      new Set(rowDemos.map((d) => d.id)).size + Math.min(added, countryCardLimit)
                    }
                  >
                    {rowDemos.map((demo, index) => (
                      <DemoCard
                        key={`${masterCat}-${demo.id}-${index}`}
                        demo={demo}
                        demoNumber={demoNumbers[index]}
                        isFavorite={favorites.includes(catalogueSlug(demo.name))}
                        onToggleFavorite={() => toggleFavorite(catalogueSlug(demo.name))}
                      />
                    ))}
                    {!searchQuery.trim() && (
                      <CountryRailCards
                        shelf={masterCat}
                        colour={
                          categoryDemos.length
                            ? shelfColour(categoryDemos)
                            : (CATALOGUE_SHELF_COLOUR[masterCat] ?? shelfColour(undefined))
                        }
                        already={categoryDemos.map((d) => catalogueSlug(d.name)).join(",")}
                        maxCards={countryCardLimit}
                        demoNumberOffset={demoNumbers.filter((number) => number !== null).length}
                        favorites={favorites}
                        onToggleFavorite={toggleFavorite}
                        onLoaded={noteAdded}
                      />
                    )}
                  </ProductCarouselRow>
                );
              })
            ) : (
              <ProductCarouselRow
                title={activeCategory}
                count={new Set(filteredDemos.map((d) => d.id)).size}
              >
                {(() => {
                  const rowDemos = fillProductRail(filteredDemos);
                  const demoNumbers = demoNumbersForCards(rowDemos);
                  return rowDemos.map((demo, index) => (
                    <DemoCard
                      key={`${activeCategory}-${demo.id}-${index}`}
                      demo={demo}
                      demoNumber={demoNumbers[index]}
                      isFavorite={favorites.includes(catalogueSlug(demo.name))}
                      onToggleFavorite={() => toggleFavorite(catalogueSlug(demo.name))}
                    />
                  ));
                })()}
              </ProductCarouselRow>
            )}
          </div>
        </section>

        {/* Reference marketplace sections (added below product grid, keeping design intact) */}
        <div className="max-w-7xl mx-auto">
          <AIZone />
          <SuccessStories />
          <AwardsRow />
          <LiveActivity />
          <ValaTV />
          <ValaAcademy />
          <PartnerEcosystem />
          <FaqSection />
          <EnterpriseCTA />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0a1628] border-t border-cyan-500/20 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} Software Vala - The Name of Trust. All rights reserved.
          </p>
          <p className="text-cyan-400 mt-2">
            {/* Was "55 Master Categories • {allDemos.length} Software Solutions •
                20 Live Demos Ready" - the length of a hand-written list and two
                fixed numbers. The catalogue's real counts, each left out when
                it could not be read. */}
            {[
              counts.categories
                ? t("marketplace.home.footer_categories", {
                    count: counts.format(counts.categories),
                  })
                : null,
              counts.products
                ? t("marketplace.home.footer_solutions_count", {
                    count: counts.format(counts.products),
                  })
                : t("marketplace.home.solutions"),
              counts.liveDemos
                ? t("marketplace.home.footer_live_demos_count", {
                    count: counts.format(counts.liveDemos),
                  })
                : t("marketplace.home.footer_live_demos"),
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
      </footer>

      {/*
        Connect Chat, reachable from the home page as well as from every
        dashboard's top bar, so a visitor can talk to Software Vala directly
        rather than hunting for a form.
      */}
      <Link
        to="/chat"
        aria-label={t("manager.home.open_chat")}
        className="sv-chat-fab fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-12px_rgba(8,145,178,0.8)] transition hover:-translate-y-0.5"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">{t("manager.home.chat_with_us")}</span>
      </Link>
    </div>
  );
};

// Demo Card Component - Enhanced with interactions
/** Deterministic pseudo-random so SSR and client render identical numbers. */
const stableSeed = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const getShareDetails = (demo: HomeDemo) => {
  const fallbackPath = `/?product=${encodeURIComponent(demo.id)}`;
  const path = demo.url && demo.url !== "#" ? demo.url : fallbackPath;
  const url = new URL(path, window.location.origin).toString();
  return {
    title: demo.name,
    text: `${demo.name} — ${LIFETIME_PRICE} one-time lifetime access on Software Vala`,
    url,
  };
};

const openShareUrl = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const shareNatively = async (demo: HomeDemo) => {
  const details = getShareDetails(demo);
  if (navigator.share) {
    try {
      await navigator.share(details);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(details.url);
  toast.success("Product link copied");
};

/**
 * The category and country of a card-slot address, /marketplace/<category>/<country>,
 * or null when the card has no slot. The marketplace's own fixed paths that share
 * that shape are not slots.
 */
const slotParams = (slotUrl: string | undefined) => {
  const match = slotUrl?.match(/^\/marketplace\/([^/?#]+)\/([^/?#]+)$/);
  if (!match || ["product", "category", "country"].includes(match[1])) return null;
  return { category: match[1], country: match[2] };
};

const DemoCard = memo(
  ({
    demo,
    demoNumber,
    isFavorite,
    onToggleFavorite,
  }: {
    demo: HomeDemo;
    demoNumber: number | null;
    isFavorite: boolean;
    onToggleFavorite: () => void;
  }) => {
    const Icon = demo.icon;
    const navigate = useNavigate();
    const { t } = useTranslation();
    const demoHref = marketplaceDemoHref({
      hasDemo: demo.status === "ACTIVE",
      slug: demo.slug,
      url: demo.url,
    });
    // The page this card opens. An author's upload takes the same address, so
    // the card keeps working when the real product arrives behind it.
    const productSlug = demo.slug ?? catalogueSlug(demo.name);
    const productHref = `/marketplace/product/${productSlug}`;
    // The router writes search values as JSON, so a string arrives quoted -
    // ?buy=%221%22 - and the product page, which looks for exactly "1", never
    // sees it. A number survives the round trip as itself.
    const openProduct = (search?: Record<string, number>) =>
      void navigate({
        to: "/marketplace/product/$slug",
        params: { slug: productSlug },
        ...(search ? { search } : {}),
      });
    // A catalogue card opens the permanent slot it occupies; Buy and Live Demo
    // still go to the product and its demo.
    const slot = slotParams(demo.slotUrl);
    const openCard = () =>
      slot ? void navigate({ to: "/marketplace/$category/$country", params: slot }) : openProduct();
    const [activeTab, setActiveTab] = useState<"features" | "tech">("features");
    const [leadAction, setLeadAction] = useState<LeadAction | null>(null);

    return (
      <div className="sv-card-shell relative">
        <ProductLeadDialog
          open={leadAction !== null}
          onOpenChange={(next) => setLeadAction(next ? leadAction : null)}
          action={leadAction ?? "buy_intent"}
          productName={demo.name}
          productId={demo.id}
        />
        <Card
          className="sv-card group h-full overflow-hidden border-cyan-500/20 bg-gradient-to-br from-[#1a2d4a] to-[#0d1e36]"
          onClick={(event) => {
            // Anything with its own destination keeps it.
            if ((event.target as HTMLElement).closest("a,button")) return;
            openCard();
          }}
        >
          <CardContent className="p-0 flex flex-col h-full">
            {/* Header with gradient */}
            <div
              className={`sv-card-head bg-gradient-to-r ${demo.color} p-4 relative overflow-hidden`}
            >
              <div className="flex justify-between items-start relative z-10">
                <div className="sv-card-icon rounded-xl bg-white/20 p-3">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div className="flex gap-2 items-center">
                  {demo.status === "COMING_SOON" && (
                    <Badge className="bg-yellow-500/90 text-black font-bold text-xs animate-pulse">
                      COMING SOON
                    </Badge>
                  )}
                  {demo.status === "ACTIVE" && (
                    <Badge className="bg-emerald-500/90 text-white font-bold text-xs flex items-center gap-1">
                      <span className="sv-live-dot" />
                      LIVE DEMO
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick action buttons on hover */}
              <div className="sv-card-quick absolute bottom-2 right-2 flex gap-2">
                <button
                  data-no-3d
                  aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                    toast.success(isFavorite ? "Removed from favorites" : "Added to favorites!");
                  }}
                  className="sv-icon-btn"
                >
                  <Heart
                    className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-white"}`}
                  />
                </button>
                <a
                  href={demoHref ?? productHref}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Preview ${demo.name}`}
                  className="sv-icon-btn"
                >
                  <Eye className="h-4 w-4 text-white" />
                </a>
              </div>
            </div>

            {/* Content */}
            <div className="sv-card-body p-5 flex-1 flex flex-col">
              <div className="sv-card-title-row flex items-start justify-between mb-1">
                {slot ? (
                  <Link
                    to="/marketplace/$category/$country"
                    params={slot}
                    className="min-w-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h3 className="sv-card-title text-[17px] font-extrabold tracking-normal leading-snug">
                      {demo.name}
                    </h3>
                  </Link>
                ) : (
                  <Link
                    to="/marketplace/product/$slug"
                    params={{ slug: productSlug }}
                    className="min-w-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h3 className="sv-card-title text-[17px] font-extrabold tracking-normal leading-snug">
                      {demo.name}
                    </h3>
                  </Link>
                )}
                {demo.status === "ACTIVE" && demoNumber !== null && (
                  <Badge className="sv-card-rank text-[10px] shrink-0 ml-2">#{demoNumber}</Badge>
                )}
              </div>
              <p className="sv-card-category text-[11px] font-semibold uppercase tracking-normal mb-2 flex items-center gap-1">
                <Award className="h-3 w-3" /> {demo.category}
              </p>
              <p className="sv-card-description text-[13px] leading-relaxed mb-3 line-clamp-2">
                {demo.description}
              </p>

              {/* Interactive Tabs */}
              <div className="sv-card-details mb-3">
                <div className="flex gap-1 mb-2">
                  <button
                    data-no-3d
                    onClick={() => setActiveTab("features")}
                    className={`sv-tab ${activeTab === "features" ? "sv-tab-on" : ""}`}
                  >
                    Features
                  </button>
                  <button
                    data-no-3d
                    onClick={() => setActiveTab("tech")}
                    className={`sv-tab ${activeTab === "tech" ? "sv-tab-on sv-tab-alt" : ""}`}
                  >
                    Tech Stack
                  </button>
                </div>

                <div className="min-h-[52px] sv-fade-swap" key={activeTab}>
                  {activeTab === "features" ? (
                    <div className="flex flex-wrap gap-1">
                      {demo.features.map((feature) => (
                        <Badge
                          key={feature}
                          variant="outline"
                          className="sv-chip sv-chip-feature text-[10px]"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  ) : demo.technologyNote ? (
                    // A software category is not one product, so the stack is
                    // whatever the implementation turns out to use.
                    <p className="sv-card-description text-[10px] leading-relaxed">
                      {demo.technologyNote}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {[...demo.frontend, ...demo.backend].map((tech) => (
                        <Badge
                          key={tech}
                          variant="outline"
                          className="sv-chip sv-chip-tech text-[10px]"
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* One fixed lifetime price across the marketplace. */}
              <div className="sv-card-price-row flex items-baseline gap-2 mb-4">
                <span className="sv-card-price-old line-through text-[13px]">{LIFETIME_MRP}</span>
                <span className="sv-price font-black text-[22px] tracking-normal">
                  {LIFETIME_PRICE}
                </span>
                <Badge className="sv-card-discount text-[10px] font-bold">
                  {LIFETIME_DISCOUNT}
                </Badge>
                <span className="sv-card-lifetime">Lifetime</span>
              </div>

              {/* Enhanced Actions */}
              <div className="sv-card-actions flex gap-2 mt-auto">
                {demo.status === "ACTIVE" ? (
                  <>
                    <Button
                      className="sv-btn sv-btn-cyan flex-1"
                      onClick={() => {
                        if (demoHref) {
                          window.open(demoHref, "_blank", "noopener,noreferrer");
                          return;
                        }
                        openProduct();
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" /> Live Demo
                    </Button>
                    <Button
                      className="sv-btn sv-btn-emerald flex-1"
                      onClick={() => openProduct({ buy: 1 })}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" /> Buy Now
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="sv-btn sv-btn-coming flex-1" disabled>
                      <Clock className="h-4 w-4 mr-2" /> Coming Soon
                    </Button>
                    <Button
                      className="sv-btn sv-btn-gold flex-1"
                      onClick={() => setLeadAction("notify_me")}
                    >
                      <Bell className="h-4 w-4 mr-2" /> Notify Me
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="sv-btn sv-btn-share"
                      aria-label={`Share ${demo.name}`}
                      title="Share product"
                    >
                      <Share2 />
                      <span className="sv-share-label">Share</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="sv-share-menu w-48">
                    <DropdownMenuItem onSelect={() => void shareNatively(demo)}>
                      <Share2 /> Share anywhere
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const details = getShareDetails(demo);
                        openShareUrl(
                          `https://wa.me/?text=${encodeURIComponent(`${details.text} ${details.url}`)}`,
                        );
                      }}
                    >
                      <MessageCircle /> WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const { url } = getShareDetails(demo);
                        openShareUrl(
                          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
                        );
                      }}
                    >
                      <Facebook /> Facebook
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const details = getShareDetails(demo);
                        openShareUrl(
                          `https://twitter.com/intent/tweet?text=${encodeURIComponent(details.text)}&url=${encodeURIComponent(details.url)}`,
                        );
                      }}
                    >
                      <span className="sv-share-x" aria-hidden="true">
                        X
                      </span>{" "}
                      X
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const { url } = getShareDetails(demo);
                        openShareUrl(
                          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
                        );
                      }}
                    >
                      <Linkedin /> LinkedIn
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const details = getShareDetails(demo);
                        window.location.href = `mailto:?subject=${encodeURIComponent(details.title)}&body=${encodeURIComponent(`${details.text}\n\n${details.url}`)}`;
                      }}
                    >
                      <Mail /> Email
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        await navigator.clipboard.writeText(getShareDetails(demo).url);
                        toast.success("Product link copied");
                      }}
                    >
                      <Copy /> Copy link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Quick Stats on hover. These were "50-99+ Clients", a "4.7-4.9"
                  rating and "5-14h" delivery, hashed from the card id - numbers
                  no client, review or order ever produced. They now state what
                  the card itself knows: its feature count, whether its demo is
                  live, and the site's stated 2-hour delivery. */}
              <div className="sv-card-stats mt-3 grid grid-cols-3">
                <div className="sv-card-stat text-center">
                  <p className="sv-card-stat-value text-lg font-bold">{demo.features.length}</p>
                  <p className="sv-card-stat-label text-[10px]">
                    {t("marketplace.home.card_features")}
                  </p>
                </div>
                <div className="sv-card-stat text-center">
                  <p className="sv-card-stat-value text-lg font-bold">
                    {demo.status === "ACTIVE"
                      ? t("marketplace.home.card_demo_live")
                      : t("marketplace.home.card_demo_soon")}
                  </p>
                  <p className="sv-card-stat-label text-[10px]">
                    {t("marketplace.home.card_demo")}
                  </p>
                </div>
                <div className="sv-card-stat text-center">
                  <p className="sv-card-stat-value text-lg font-bold">
                    {t("marketplace.home.card_delivery_value")}
                  </p>
                  <p className="sv-card-stat-label text-[10px]">
                    {t("marketplace.home.card_delivery")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);
DemoCard.displayName = "DemoCard";

export default Index;
