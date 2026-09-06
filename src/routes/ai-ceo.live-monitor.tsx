import { createFileRoute } from "@tanstack/react-router";
import AICEOLiveMonitor from "@/components/ai-ceo/sections/AICEOLiveMonitor";

export const Route = createFileRoute("/ai-ceo/live-monitor")({
  head: () => ({
    meta: [
      { title: "Live Action Monitor — Software Vala" },
      { name: "description", content: "Real-time stream of every action across the ecosystem, watched by the AI CEO." },
      { property: "og:title", content: "Live Action Monitor — Software Vala" },
      { property: "og:description", content: "Real-time stream of every action across the ecosystem, watched by the AI CEO." },
    ],
  }),
  component: AICEOLiveMonitor,
});
