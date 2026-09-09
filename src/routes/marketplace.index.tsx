import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import HomeIndex from "@/components/marketplace-home/HomeIndex";
import {
  loadHomeRouteData,
  type HomeRouteData,
} from "@/lib/marketplace/home-route-data";

/** /marketplace itself, which is the marketplace home. */
export const Route = createFileRoute("/marketplace/")({
  head: pageHead("Marketplace", "Browse ready-to-deploy software with live demos, full source code and lifetime access."),
  /**
   * The same loader the home page runs. Without it this route sent a shell -
   * 123 KB against the home page's 1.13 MB - because every part of HomeIndex
   * reads the loader data and there was none to read here.
   */
  loader: async (): Promise<HomeRouteData> => loadHomeRouteData(),
  component: HomeIndex,
});
