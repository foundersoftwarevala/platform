import { createFileRoute } from "@tanstack/react-router";

import { AutomationsWorkspace } from "@/components/ai-ceo/ops/Automations";

export const Route = createFileRoute("/ai-ceo/automations")({
  head: () => ({
    meta: [
      { title: "Automations — AI CEO" },
      {
        name: "description",
        content: "Everything that runs without being asked, across all four rule tables.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AutomationsWorkspace,
});
