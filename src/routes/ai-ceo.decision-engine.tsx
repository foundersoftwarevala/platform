import { createFileRoute } from "@tanstack/react-router";
import AICEODecisionEngine from "@/components/ai-ceo/sections/AICEODecisionEngine";

export const Route = createFileRoute("/ai-ceo/decision-engine")({
  head: () => ({
    meta: [
      { title: "AI Decision Engine — Software Vala" },
      { name: "description", content: "How the AI CEO reasons: signals, weights, confidence and recommended decisions." },
      { property: "og:title", content: "AI Decision Engine — Software Vala" },
      { property: "og:description", content: "How the AI CEO reasons: signals, weights, confidence and recommended decisions." },
    ],
  }),
  component: AICEODecisionEngine,
});
