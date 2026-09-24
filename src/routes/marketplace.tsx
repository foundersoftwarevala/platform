import { createFileRoute, Outlet } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";

/**
 * The layout every /marketplace page sits inside.
 *
 * This rendered the marketplace home component directly and never rendered an
 * Outlet, so every page beneath it - a category, a product, a country - was
 * matched, had its title and structured data built, and then was not drawn at
 * all: the visitor got the marketplace home under the product's title. The
 * child is drawn here now, and /marketplace itself keeps the home component
 * through its own index route.
 */
export const Route = createFileRoute("/marketplace")({
  // No canonical here. This is the layout every /marketplace page sits
  // inside, and a canonical declared on it is inherited by every child, so a
  // slot, a product and a category page all announced themselves as
  // /marketplace - forty-three of them in a sample of forty-six. The canonical
  // for /marketplace itself belongs on its index route, which is the page.
  head: pageHead(
    "Marketplace",
    "Browse ready-to-deploy software with live demos, full source code and lifetime access.",
  ),
  component: () => <Outlet />,
});
