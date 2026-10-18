import { createFileRoute } from "@tanstack/react-router";

import { SecurityCenter } from "@/components/ai-ceo/ops/Registers";

export const Route = createFileRoute("/ai-ceo/security")({
  head: () => ({
    meta: [
      { title: "Security signals — AI CEO" },
      {
        name: "description",
        content: "Alerts the platform raised and findings its scanners recorded.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SecurityCenter,
});
