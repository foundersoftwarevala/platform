import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/sapphire-home.css";
import HomeIndex from "@/components/sapphire-home/HomeIndex";
import { absoluteUrl } from "@/lib/seo/site-url";
import { getPublicHomeSeo } from "@/lib/i18n/public-seo.functions";

export const Route = createFileRoute("/")({
  // Database counts feed the visible catalogue badge and descriptive metadata.
  // Each read is independently bounded; a failed count is omitted, never guessed.
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
        products: stats?.products ?? null,
        categories: headline?.visibleCategories ?? null,
        liveDemos: stats?.liveDemos ?? null,
        bootstrap: context.languageBootstrap,
      },
    });
    return { headline, stats, chrome, seo };
  },
  head: ({ loaderData }) => {
    const headline = loaderData?.headline ?? null;
    const categories = headline ? headline.visibleCategories : null;
    const title = "Software Vala - The Name of Trust";
    const description =
      loaderData?.seo.description ??
      (categories
        ? `Browse ready-to-deploy software solutions across ${categories} categories with live demos, full source code and lifetime access.`
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
