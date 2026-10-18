import { createFileRoute } from "@tanstack/react-router";

import { NotificationCenter } from "@/components/ai-ceo/ops/Registers";

export const Route = createFileRoute("/ai-ceo/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — AI CEO" },
      {
        name: "description",
        content: "What the platform has raised to an operator, newest first.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotificationCenter,
});
