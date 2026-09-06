import { createFileRoute } from "@tanstack/react-router";
import AICEORiskCompliance from "@/components/ai-ceo/sections/AICEORiskCompliance";

export const Route = createFileRoute("/ai-ceo/risk")({
  head: () => ({
    meta: [
      { title: "Risk & Compliance — Software Vala" },
      { name: "description", content: "AI risk detection, compliance posture and escalation tracking." },
      { property: "og:title", content: "Risk & Compliance — Software Vala" },
      { property: "og:description", content: "AI risk detection, compliance posture and escalation tracking." },
    ],
  }),
  component: AICEORiskCompliance,
});
