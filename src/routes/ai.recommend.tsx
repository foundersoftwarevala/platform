import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo/site-url";
import { Recommendations } from "@/components/marketplace-tools/ProductTools";
import "@/styles/marketplace-home.css";

export const Route = createFileRoute("/ai/recommend")({
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/ai/recommend") }],
    meta: [
      { title: "AI Recommendation | Software Vala" },
      {
        name: "description",
        content: "The products the Software Vala marketplace is opening most right now.",
      },
      { property: "og:title", content: "AI Recommendation | Software Vala" },
      {
        property: "og:description",
        content: "The products the Software Vala marketplace is opening most right now.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Recommendations,
});
