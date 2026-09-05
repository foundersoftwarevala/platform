import { createFileRoute } from "@tanstack/react-router";
import { CompareTool } from "@/components/marketplace-tools/ProductTools";
import "@/styles/marketplace-home.css";

export const Route = createFileRoute("/ai/compare")({
  head: () => ({
    meta: [
      { title: "AI Compare | Software Vala" },
      { name: "description", content: "Compare up to four Software Vala products side by side on price, stack, modules and licence." },
      { property: "og:title", content: "AI Compare | Software Vala" },
      { property: "og:description", content: "Compare up to four Software Vala products side by side on price, stack, modules and licence." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CompareTool,
});
