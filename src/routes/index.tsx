import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/sapphire-home.css";
import HomeIndex from "@/components/sapphire-home/HomeIndex";
import { absoluteUrl } from "@/lib/seo/site-url";
import { getPublicHomeSeo } from "@/lib/i18n/public-seo.functions";

export const Route = createFileRoute("/")({
  /**
   * The catalogue's real size, for the title and description below.
   *
   * It read "147 Software Solutions ... across 20 master categories" while the
   * catalogue held 7,357 visible products across 91 categories - written by hand
   * when it was true and wrong ever since, in the first line a search engine
   * reads. It is counted in SQL now so it cannot drift again.
   *
   * The loader cannot fail the page: getCatalogueHeadline returns null on any
   * problem and gives up after a second and a half, and the copy below then
   * carries no number rather than a wrong one. This page has real visitors on
   * it, and no piece of metadata is worth a blank screen.
   */
  /*
   * Alongside it, two more reads the page's own sections quote: the live-demo
   * count (getHomeStats) and the published Vala TV films (the storefront
   * chrome). Each is settled on its own and capped at a second and a half, so
   * none of them can fail or stall the page - a missing answer only means that
   * section shows no number, or does not render.
   */
  loader: async ({ context }) => {
    const [{ getCatalogueHeadline }, { getHomeStats }, { getStorefrontChrome }] = await Promise.all(
      [
        import("@/lib/seo/catalogue-headline.server"),
        import("@/lib/marketplace/home-stats.functions"),
        import("@/lib/storefront/chrome.functions"),
      ],
    );
    const capped = <T,>(read: () => Promise<T>): Promise<T | null> =>
      Promise.race([
        read().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
    const [headline, stats, chrome] = await Promise.all([
      capped(() => getCatalogueHeadline()),
      capped(() => getHomeStats()),
      capped(() => getStorefrontChrome()),
    ]);
    const seo = await getPublicHomeSeo({
      data: {
        products: headline?.products ?? null,
        categories: headline?.visibleCategories ?? null,
        bootstrap: context.languageBootstrap,
      },
    });
    return { headline, stats, chrome, seo };
  },
  head: ({ loaderData }) => {
    const headline = loaderData?.headline ?? null;
    const count = headline ? headline.products.toLocaleString("en-IN") : null;
    const categories = headline ? headline.visibleCategories : null;
    const title =
      loaderData?.seo.title ??
      (count
        ? `Software Vala — ${count} Software Solutions Marketplace`
        : "Software Vala — Software Solutions Marketplace");
    const description =
      loaderData?.seo.description ??
      (count
        ? `Browse ${count} ready-to-deploy software solutions across ${categories} categories with live demos, full source code and lifetime access.`
        : "Browse ready-to-deploy software solutions with live demos, full source code and lifetime access.");

    return {
      links: [{ rel: "canonical", href: absoluteUrl("/") }],
      meta: [
        { title },
        {
          name: "description",
          content: description,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content:
            loaderData?.seo.social ??
            (categories
              ? `Live demos, full source code, 1 year free support and lifetime access across ${categories} categories.`
              : "Live demos, full source code, 1 year free support and lifetime access."),
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl("/") },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => (
    <>
      <Index />
      {/* Without this, every message this page tries to show is invisible. */}
      <Toaster />
    </>
  ),
});

const HomeLoading = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0a1526]">
    <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
  </div>
);

function Index() {
  return (
    <div className="mpc-home sv-wide">
      <Suspense fallback={<HomeLoading />}>
        <HomeIndex />
      </Suspense>
    </div>
  );
}
