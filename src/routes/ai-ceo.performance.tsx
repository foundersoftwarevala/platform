import { createFileRoute } from "@tanstack/react-router";
import AICEOPerformance from "@/components/ai-ceo/sections/AICEOPerformance";

export const Route = createFileRoute("/ai-ceo/performance")({
  head: () => ({
    meta: [
      { title: "Performance Intelligence — Software Vala" },
      { name: "description", content: "AI performance intelligence across teams, regions and modules." },
      { property: "og:title", content: "Performance Intelligence — Software Vala" },
      { property: "og:description", content: "AI performance intelligence across teams, regions and modules." },
    ],
  }),
  component: AICEOPerformance,
});
