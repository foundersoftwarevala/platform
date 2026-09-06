import { createFileRoute } from "@tanstack/react-router";
import AICEOPredictions from "@/components/ai-ceo/sections/AICEOPredictions";

export const Route = createFileRoute("/ai-ceo/predictions")({
  head: () => ({
    meta: [
      { title: "Predictive Insights — Software Vala" },
      { name: "description", content: "AI forecasting and opportunity detection for the coming quarters." },
      { property: "og:title", content: "Predictive Insights — Software Vala" },
      { property: "og:description", content: "AI forecasting and opportunity detection for the coming quarters." },
    ],
  }),
  component: AICEOPredictions,
});
