import { createFileRoute } from "@tanstack/react-router";

import { TaskCenter } from "@/components/ai-ceo/ops/TaskCenter";

export const Route = createFileRoute("/ai-ceo/tasks/")({
  head: () => ({
    meta: [
      { title: "Tasks — AI CEO" },
      {
        name: "description",
        content: "Work recorded across the platform, with the promise each one was made under.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TaskCenter,
});
