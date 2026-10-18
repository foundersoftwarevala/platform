import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo/site-url";
import { ProductFinder } from "@/components/marketplace-tools/ProductTools";
import "@/styles/marketplace-home.css";

export const Route = createFileRoute("/ai/finder")({
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/ai/finder") }],
    meta: [
      { title: "AI Product Finder | Software Vala" },
      {
        name: "description",
        content:
          "Describe what your business needs and see the products in the Software Vala catalogue that match.",
      },
      { property: "og:title", content: "AI Product Finder | Software Vala" },
      {
        property: "og:description",
        content:
          "Describe what your business needs and see the products in the Software Vala catalogue that match.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProductFinder,
});
