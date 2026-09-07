import { Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/marketplace-home.css";
import HomeIndex from "@/components/marketplace-home/HomeIndex";
import { HomeBoundary, HomeShellFallback } from "@/components/marketplace-home/SectionBoundary";
import { getHomeCatalog, type HomeCatalogSeed } from "@/lib/marketplace/home-catalog.functions";
import { getHomeLayout, type HomeLayout } from "@/lib/marketplace/home-layout.functions";
import { getStorefrontChrome, type StorefrontChrome } from "@/lib/storefront/chrome.functions";
import { absoluteUrl } from "@/lib/seo/site-url";

export const Route = createFileRoute("/")({
  /**
   * Fetch the first rows before the page is sent, so the HTML that leaves the
   * server carries real category and product links. Without this the front
   * door of the catalogue was an empty document and nothing below it could be
   * followed. A failure here returns nothing and the browser asks for the rows
   * itself, exactly as it did before.
   */
  loader: async (): Promise<{
    seed: HomeCatalogSeed;
    layout: HomeLayout;
    chrome: StorefrontChrome | null;
  }> => {
    // Settled rather than all, so one failing lookup cannot take the others
    // with it. The catalogue, the layout and the chrome are unrelated
    // questions and the page has a safe answer for each of them missing.
    const [seed, layout, chrome] = await Promise.allSettled([
      getHomeCatalog(),
      getHomeLayout(),
      getStorefrontChrome(),
    ]);
    return {
      seed: seed.status === "fulfilled" ? seed.value : null,
      // Null means "registry unreadable", which renders the built-in order —
      // never an empty page.
      layout: layout.status === "fulfilled" ? layout.value : null,
      // Null means "nothing published or unreadable", which renders the
      // footer this build ships with and no floating elements at all.
      chrome: chrome.status === "fulfilled" ? chrome.value : null,
    };
  },

  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    meta: [
      { title: "Software Vala — 12,000+ Software Solutions Marketplace" },
      {
        name: "description",
        content:
          "Browse 12,000+ ready-to-deploy software solutions across 80+ master categories with live demos, full source code and lifetime access.",
      },
      { property: "og:title", content: "Software Vala — 12,000+ Software Solutions Marketplace" },
      {
        property: "og:description",
        content:
          "One fixed price — $249 one-time for lifetime access. Live demos, full source code and 1 year free support across 80+ categories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
  // `/` is a protected production route. Even if the router or the loader
  // fails, visitors must land on Software Vala — never on a blank page or the
  // generic "this page didn't load" card from the root boundary.
  errorComponent: () => <HomeShellFallback />,
});

const HomeLoading = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1526]">
    <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
  </div>
);

function Index() {
  return (
    <div className="mpc-home">
      <HomeBoundary>
        <Suspense fallback={<HomeLoading />}>
          <HomeIndex />
        </Suspense>
      </HomeBoundary>
    </div>
  );
}
