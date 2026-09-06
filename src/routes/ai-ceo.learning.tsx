import { createFileRoute } from "@tanstack/react-router";
import AICEOLearning from "@/components/ai-ceo/sections/AICEOLearning";

export const Route = createFileRoute("/ai-ceo/learning")({
  head: () => ({
    meta: [
      { title: "System Learning Log — Software Vala" },
      { name: "description", content: "AI memory and knowledge base: what the system has learned over time." },
      { property: "og:title", content: "System Learning Log — Software Vala" },
      { property: "og:description", content: "AI memory and knowledge base: what the system has learned over time." },
    ],
  }),
  component: AICEOLearning,
});
