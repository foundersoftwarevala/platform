import { createFileRoute } from "@tanstack/react-router";
import { ProductFinder } from "@/components/marketplace-tools/ProductTools";
import "@/styles/marketplace-home.css";

export const Route = createFileRoute("/ai/finder")({
  head: () => ({
    meta: [
      { title: "AI Product Finder | Software Vala" },
      { name: "description", content: "Describe what your business needs and see the products in the Software Vala catalogue that match." },
      { property: "og:title", content: "AI Product Finder | Software Vala" },
      { property: "og:description", content: "Describe what your business needs and see the products in the Software Vala catalogue that match." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProductFinder,
});
