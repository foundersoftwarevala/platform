import { useMatch } from "@tanstack/react-router";
import { getHomeCatalog, type HomeCatalogSeed } from "@/lib/marketplace/home-catalog.functions";
import { getHomeLayout, type HomeLayout } from "@/lib/marketplace/home-layout.functions";
import { getStorefrontChrome, type StorefrontChrome } from "@/lib/storefront/chrome.functions";
import { getCardComposition, type CardComposition } from "@/lib/marketplace/card-composition.functions";
import { listHeroSlidesPublic, type HeroSlide } from "@/lib/marketplace-content/hero.functions";

/**
 * The data the marketplace home needs before it is sent.
 *
 * HomeIndex is the component behind two routes - `/` and `/marketplace/` - but
 * only `/` ever had a loader, so `/marketplace/` shipped 123 KB of shell where
 * `/` ships 1.13 MB of real rows, and everything below it had to be fetched
 * again in the browser. This is that one loader, in one place, so the two routes
 * cannot drift apart and neither has a copy of the other's logic.
 */
export type HomeRouteData = {
  seed: HomeCatalogSeed;
  layout: HomeLayout;
  chrome: StorefrontChrome | null;
  composition: CardComposition | null;
  slides: HeroSlide[] | null;
};

/**
 * Fetch the first rows before the page is sent, so the HTML that leaves the
 * server carries real category and product links. Without this the front door
 * of the catalogue is an empty document and nothing below it can be followed.
 * A failure returns nothing and the browser asks for the rows itself, exactly
 * as it did before.
 */
export async function loadHomeRouteData(): Promise<HomeRouteData> {
  // Settled rather than all, so one failing lookup cannot take the others with
  // it. The catalogue, the layout and the chrome are unrelated questions and
  // the page has a safe answer for each of them missing.
  const [seed, layout, chrome, composition, slides] = await Promise.allSettled([
    getHomeCatalog(),
    getHomeLayout(),
    getStorefrontChrome(),
    getCardComposition(),
    // Fetched here so the carousel never suspends during the server render. It
    // was the one thing on the page that did, and because the page also sits
    // inside a Suspense, that single suspend replaced the whole document with a
    // spinner.
    listHeroSlidesPublic(),
  ]);
  return {
    seed: seed.status === "fulfilled" ? seed.value : null,
    // Null means "registry unreadable", which renders the built-in order —
    // never an empty page.
    layout: layout.status === "fulfilled" ? layout.value : null,
    // Null means "nothing published or unreadable", which renders the footer
    // this build ships with and no floating elements at all.
    chrome: chrome.status === "fulfilled" ? chrome.value : null,
    // Null renders every card field, which is what the card does without any
    // configuration at all.
    composition: composition.status === "fulfilled" ? composition.value : null,
    // Null means the carousel fetches them itself, as it did before.
    slides: slides.status === "fulfilled" ? slides.value : null,
  };
}

/**
 * The loader data for whichever of the two home routes is showing.
 *
 * Every part of the page used to ask `useMatch({ from: "/" })`, which is null on
 * `/marketplace/`, so on that route each one silently fell back to fetching for
 * itself. Asking both routes means a component does not need to know which door
 * the visitor came through.
 *
 * `shouldThrow: false` on both, so a component rendered anywhere else - a
 * category page, a product page - keeps getting null and its own fallback,
 * which is what it has always done.
 */
export function useHomeRouteData(): Partial<HomeRouteData> | undefined {
  const home = useMatch({ from: "/", shouldThrow: false });
  const marketplace = useMatch({ from: "/marketplace/", shouldThrow: false });
  return (home?.loaderData ?? marketplace?.loaderData) as Partial<HomeRouteData> | undefined;
}

/**
 * The same answer shaped like a router match, so a call site that already reads
 * `?.loaderData` can swap `useMatch({ from: "/" })` for this and change nothing
 * else.
 */
export function useHomeRouteMatch(): { loaderData: Partial<HomeRouteData> } | undefined {
  const data = useHomeRouteData();
  return data ? { loaderData: data } : undefined;
}
