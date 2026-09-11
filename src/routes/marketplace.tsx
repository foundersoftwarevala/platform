import { createFileRoute, Outlet } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Toaster } from "@/components/ui/sonner";
import { MAX_VISIBLE_TOASTS } from "@/lib/portal/config";
import { PortalError } from "@/components/portal/PortalError";

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
  head: pageHead("Marketplace", "Browse ready-to-deploy software with live demos, full source code and lifetime access."),
  /*
   * The layout is also where the marketplace's notifications finally have
   * somewhere to appear.
   *
   * Every page beneath this one raises its refusals through `toast` -- the
   * product page's "Please sign in to buy", and the "nothing was added to your
   * cart" that follows any other failure -- and no `<Toaster />` was mounted
   * anywhere above them, so Sonner composed each message and dropped it. A
   * visitor whose Add to cart failed for any reason other than being signed out
   * saw the button move and nothing else happen. That is a dead button by
   * S50's definition, on the control the whole storefront exists to lead to.
   *
   * Mounted once here rather than on each child, so the four marketplace pages
   * share one and a visitor moving between them does not stack a second.
   */
  component: () => (
    <>
      <Outlet />
      <Toaster visibleToasts={MAX_VISIBLE_TOASTS} />
    </>
  ),
  // A crash in one marketplace page is contained here instead of replacing the
  // whole application through the root boundary.
  errorComponent: PortalError,
});
