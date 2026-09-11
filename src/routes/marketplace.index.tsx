import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import HomeIndex from "@/components/marketplace-home/HomeIndex";
import { HomeShellFallback } from "@/components/marketplace-home/SectionBoundary";
import {
  loadHomeRouteData,
  type HomeRouteData,
} from "@/lib/marketplace/home-route-data";
import { absoluteUrl } from "@/lib/seo/site-url";

const marketplaceHead = pageHead(
  "Marketplace",
  "Browse ready-to-deploy software with live demos, full source code and lifetime access.",
);

/** /marketplace itself, which is the marketplace home. */
export const Route = createFileRoute("/marketplace/")({
  // The same page as "/" - same loader, same component, same content - so it
  // names "/" as its canonical rather than competing with it as a duplicate.
  head: () => ({
    ...marketplaceHead(),
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  /**
   * The same loader the home page runs. Without it this route sent a shell -
   * 123 KB against the home page's 1.13 MB - because every part of HomeIndex
   * reads the loader data and there was none to read here.
   */
  loader: async (): Promise<HomeRouteData> => loadHomeRouteData(),
  component: HomeIndex,
  /*
   * /marketplace/ draws the same storefront component as `/`, so it degrades the
   * same way. `/` already refuses to fall through to the generic root boundary
   * -- the storefront must never come back as a blank page or a "this page
   * didn't load" card -- and this route rendering the identical component had no
   * such guard, which meant the same crash produced the marketplace on one URL
   * and an error card on the other.
   */
  errorComponent: () => <HomeShellFallback />,
});
