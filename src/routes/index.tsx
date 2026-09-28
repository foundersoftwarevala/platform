import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { createFileRoute } from "@tanstack/react-router";
import "@/styles/sapphire-home.css";
import HomeIndex from "@/components/sapphire-home/HomeIndex";
import { absoluteUrl } from "@/lib/seo/site-url";

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
  loader: async () => {
    const { getCatalogueHeadline } = await import("@/lib/seo/catalogue-headline.server");
    try {
      return { headline: await getCatalogueHeadline() };
    } catch {
      return { headline: null };
    }
  },
  head: ({ loaderData }) => {
    const headline = loaderData?.headline ?? null;
    const count = headline ? headline.products.toLocaleString("en-IN") : null;
    const categories = headline ? headline.visibleCategories : null;
    const title = count
      ? `Software Vala — ${count} Software Solutions Marketplace`
      : "Software Vala — Software Solutions Marketplace";
    const description = count
      ? `Browse ${count} ready-to-deploy software solutions across ${categories} categories with live demos, full source code and lifetime access.`
      : "Browse ready-to-deploy software solutions with live demos, full source code and lifetime access.";

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
        content: categories
          ? `Live demos, full source code, 1 year free support and lifetime access across ${categories} categories.`
          : "Live demos, full source code, 1 year free support and lifetime access.",
      },
      { property: "og:type", content: "website" },
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
