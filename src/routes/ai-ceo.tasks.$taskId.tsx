import { createFileRoute } from "@tanstack/react-router";

import { TaskDetail } from "@/components/ai-ceo/ops/TaskCenter";

export const Route = createFileRoute("/ai-ceo/tasks/$taskId")({
  head: () => ({
    meta: [
      { title: "Task — AI CEO" },
      { name: "description", content: "The promise and the effort recorded against one task." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  return <TaskDetail taskId={taskId} />;
}
