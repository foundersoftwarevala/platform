import { createFileRoute } from "@tanstack/react-router";
import AICEOSettings from "@/components/ai-ceo/sections/AICEOSettings";

export const Route = createFileRoute("/ai-ceo/settings")({
  head: () => ({
    meta: [
      { title: "AI CEO Settings — Software Vala" },
      { name: "description", content: "Read-only AI CEO configuration, permissions and operating boundaries." },
      { property: "og:title", content: "AI CEO Settings — Software Vala" },
      { property: "og:description", content: "Read-only AI CEO configuration, permissions and operating boundaries." },
    ],
  }),
  component: AICEOSettings,
});
